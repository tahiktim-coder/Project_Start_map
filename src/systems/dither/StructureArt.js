/* StructureArt — THE STRUCTURE, drawn by its dead.
   Forty-one thousand hulls. The rings are made of ships; a river of them comes in from the left and ends at the lit edge;
   near the slab they lie in perfect rows, as if filed, and the edge reads them one row at a time. The slab itself is pure:
   flat black, straight edges, no noise. Two warm lights only: your engine, and the gold disc held just off the lit edge.

     render(s, t, H)       the BODY (map node, side panel, hero): writes s.gray / s.acc / s.mask
     renderVista(v, t, H)  the ORBIT VISTA, any size: the slab runs off the frame, the fleet lies on a plane to the horizon
     look                  its own ramp (six violet stops) and one amber accent

   Everything that does not move is painted once per size and cached; per frame only the reading row, the rings, the disc
   and the ship are drawn. Designed and tuned offline against real renders (scratchpad structure_lab/harness.js). */

(function () {
    'use strict';
    const TAU = Math.PI * 2;
    const LOOK = { ramp: ['#06070a', '#140a24', '#3a1f66', '#8844ff', '#b79bff', '#f2ecff'], accent: [255, 176, 64] };
    const TOP_STOP = LOOK.ramp.length - 1, CONTRAST = 1.1;   // the harness/game contrast; lets us ask for an exact stop
    const CACHE_LIMIT = 8;

    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
    /** Tone that quantizes to exactly ramp stop `stop` with no dither (pure, flat colour). */
    const flat = stop => (stop / TOP_STOP - 0.5) / CONTRAST + 0.5 + 1e-4;

    const BLACK = flat(0), FACE = flat(1), DIM = flat(2), VIOLET = flat(3), PALE = flat(4), WHITE = flat(5);
    const SILHOUETTE_OVER = flat(2.35);    // backdrop brighter than this → hulls turn into dark silhouettes

    // ── tiny raster helpers (all clipped, no allocation) ──
    function fillRect(b, x, y, rw, rh, tone, accent) {
        const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(b.w, x + rw), y1 = Math.min(b.h, y + rh);
        for (let py = y0; py < y1; py++) {
            let i = py * b.w + x0;
            for (let px = x0; px < x1; px++, i++) { b.gray[i] = tone; b.acc[i] = accent; b.mask[i] = 1; }
        }
    }

    /** A box turned by (cos, sin); the end that points right gets `capTone` (the side facing the lit edge). */
    function fillBox(b, cx, cy, halfLen, halfThick, cos, sin, tone, capTone) {
        if (cos < 0) { cos = -cos; sin = -sin; }
        const ex = Math.abs(cos) * halfLen + Math.abs(sin) * halfThick + 1, ey = Math.abs(sin) * halfLen + Math.abs(cos) * halfThick + 1;
        const x0 = Math.max(0, Math.floor(cx - ex)), x1 = Math.min(b.w - 1, Math.ceil(cx + ex));
        const y0 = Math.max(0, Math.floor(cy - ey)), y1 = Math.min(b.h - 1, Math.ceil(cy + ey));
        const capFrom = halfLen * 0.35;
        for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
            const dx = px - cx, dy = py - cy, along = dx * cos + dy * sin, across = dy * cos - dx * sin;
            if (Math.abs(along) > halfLen + 0.05 || Math.abs(across) > halfThick + 0.05) continue;
            const i = py * b.w + px;
            b.gray[i] = along > capFrom ? capTone : tone; b.acc[i] = 0; b.mask[i] = 1;
        }
    }

    /** A dead hull lying in its row: body, a lit cap on the end facing the edge, and a bridge once it is big enough to have one. */
    function drawHull(b, x, y, len, thick, tone, capTone) {
        fillRect(b, x, y, len, thick, tone, 0);
        fillRect(b, x + len - Math.max(1, Math.round(len * 0.25)), y, Math.max(1, Math.round(len * 0.25)), thick, capTone, 0);
        if (len < 8) return;
        const bridgeH = Math.max(1, Math.round(thick * 0.5)), bridgeW = Math.max(2, Math.round(len * 0.3));
        fillRect(b, x + Math.round(len * 0.2), y - bridgeH, bridgeW, bridgeH, tone, 0);
        fillRect(b, x + Math.round(len * 0.2) + bridgeW - 1, y - bridgeH, 1, bridgeH, capTone, 0);
    }

    /** The one living ship: bright hull, nose toward the lit edge (left), an amber engine that flickers and a running light that blinks. */
    function drawLivingShip(b, x, y, len, thick, t) {
        const flicker = Math.floor(t / 250) % 2, blink = Math.floor(t / 750) % 2;
        fillRect(b, x + 1, y, len - 1, thick, PALE, 0);
        fillRect(b, x, y + Math.floor(thick / 2), 2, 1, WHITE, 0);                                   // nose
        fillRect(b, x + 1, y, len - 2, 1, WHITE, 0);                                                  // lit spine
        const bridgeW = Math.max(2, Math.round(len * 0.3)), bridgeH = Math.max(1, Math.round(thick * 0.5));
        fillRect(b, x + Math.round(len * 0.45), y - bridgeH, bridgeW, bridgeH, WHITE, 0);
        const flame = Math.max(2, Math.round(len * 0.3)) + flicker;
        fillRect(b, x + len, y + Math.floor((thick - 1) / 2), flame, Math.max(1, thick - 2), WHITE, 1);     // engine: the only warm light here
        fillRect(b, x + len + flame, y + Math.floor(thick / 2), 1 + flicker, 1, VIOLET, 1);
        if (blink) fillRect(b, x + Math.round(len * 0.45), y - bridgeH - 1, 1, 1, WHITE, 1);
    }

    function remember(cache, key, build) {
        if (cache.has(key)) return cache.get(key);
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
        const made = build(); cache.set(key, made); return made;
    }

    // ═════════════════════════════ THE VISTA ═════════════════════════════
    const VISTA = {
        EDGE_X: 0.6, SLAB_W: 0.3, HORIZON_Y: 0.2, CONTACT_Y: 0.5,      // fractions of the panel
        SLAB_WORLD_W: 0.5,                                              // the slab is half a world unit wide; it stands at depth 1
        HULL_LEN: 4, HULL_THICK: 1.25, HULL_PITCH: 7, ROW_PITCH: 4.4,   // px at depth 1, for a 480×270 panel
        RINGS: [{ r: 0.44, turn: 9000 }, { r: 0.63, turn: 13000 }, { r: 0.86, turn: 19000 }],
        RING_GAP: 0.03, RING_HULL: 5.2, RING_PITCH: 0.042,
        BEAM_STEP_MS: 375, BEAM_START: 17,
    };

    function vistaLayout(w, h) {
        const unit = (w + h * 16 / 9) / 960;
        const edgeX = Math.round(w * VISTA.EDGE_X), slabW = Math.round(w * VISTA.SLAB_W);
        const horizonY = Math.round(h * VISTA.HORIZON_Y), contactY = Math.round(h * VISTA.CONTACT_Y);
        return { w, h, unit, edgeX, slabW, edgeW: Math.max(2, Math.round(3 * unit)), horizonY, contactY, depthK: contactY - horizonY, focal: slabW / VISTA.SLAB_WORLD_W };
    }

    /** Light leaving the edge: only ever to the left, in flat horizontal sheets that refuse to spread. */
    function paintLight(b, L, H, rand) {
        const { w, h, edgeX, contactY } = L;
        const sheet = new Float32Array(h);
        for (let y = 0; y < h;) {                                       // crisp bands of differing strength — geometry, not noise
            const tall = Math.round((9 + rand() * 22) * L.unit), gain = 0.93 + rand() * 0.14;
            for (let k = 0; k < tall && y < h; k++, y++) sheet[y] = gain;
        }
        for (let y = 0; y < h; y++) {
            const pool = 0.7 + 0.3 * Math.exp(-Math.pow((y - contactY) / (h * 0.36), 2));
            for (let x = 0; x < w; x++) {
                const i = y * w + x, haze = H.fbm(x * 0.011 + 3.1, y * 0.014 + 7.7, 3);
                let tone = 0.035 + 0.2 * Math.max(0, haze - 0.34);
                if (x < edgeX) {
                    const d = (edgeX - x) / w;
                    tone += (0.6 * Math.exp(-d / 0.15) + 0.17 * Math.exp(-d / 0.45)) * pool * sheet[y];
                } else tone += 0.06 * smooth(edgeX + L.slabW, w, x);
                b.gray[i] = tone;
            }
        }
    }

    function paintStars(b, L, rand) {
        const count = Math.round(L.w * L.h / 520);
        for (let k = 0; k < count; k++) {
            const x = Math.floor(rand() * L.w), y = Math.floor(rand() * L.h), big = rand() < 0.12, i = y * L.w + x;
            if (b.gray[i] > 0.2) continue;                                // the light washes them out
            b.gray[i] = big ? PALE : DIM + rand() * 0.2;
            if (big && x + 1 < L.w) b.gray[i + 1] = VIOLET;
        }
    }

    function paintSlab(b, L) {
        fillRect(b, L.edgeX, 0, L.slabW, L.h, BLACK, 0);                  // pure: one flat black, top to bottom and beyond
        fillRect(b, L.edgeX + L.slabW - 1, 0, 1, L.h, FACE, 0);
        fillRect(b, L.edgeX - 2, 0, 2, L.h, PALE, 0);                     // bloom hugging the lit edge
        fillRect(b, L.edgeX, 0, L.edgeW, L.h, WHITE, 0);
    }

    /** The filed fleet: horizontal rows of hulls on a plane that runs to the horizon; order near the edge, tumbling chaos far from it. */
    function buildFleet(L, rand) {
        const ships = [], rows = [];
        for (let y = L.horizonY + 2; y < L.h + 10;) {
            const scale = (y - L.horizonY) / L.depthK, depth = 1 / scale;
            const len = Math.max(2, Math.round(VISTA.HULL_LEN * L.unit * scale)), thick = Math.max(1, Math.round(VISTA.HULL_THICK * L.unit * scale));
            const pitch = Math.max(len + 3, Math.round(VISTA.HULL_PITCH * L.unit * scale));
            const rowStep = Math.max(thick + 3, Math.round(VISTA.ROW_PITCH * L.unit * scale * scale));
            const first = ships.length, fade = smooth(0, 0.45, scale), farThin = 0.78 * (1 - smooth(0.16, 0.6, scale));
            for (let x = L.edgeX - 3 - Math.round(pitch * 0.5) - len; x > -len; x -= pitch) {
                const worldX = (x + len / 2 - L.edgeX) / (L.focal * scale);
                const chaos = depth < 1 ? smooth(0.42, 0.95, Math.hypot(worldX * 0.85, (1 - depth) * 1.35)) : smooth(1.0, 1.9, -worldX) * (scale > 0.55 ? 1 : 0);
                const rollSkip = rand(), rollX = rand(), rollY = rand(), rollTurn = rand(), rollFar = rand();
                if (rollSkip < chaos * 0.5 || rollFar < farThin) continue;
                if (onRing(worldX, depth)) continue;                      // the rings sweep clean lanes through the rows
                ships.push({
                    x: x + Math.round((rollX - 0.5) * pitch * 0.9 * chaos), y: y + Math.round((rollY - 0.5) * rowStep * 0.8 * chaos),
                    len, thick, turn: chaos > 0.25 ? (rollTurn - 0.5) * 2.6 * chaos : 0, fade,
                });
            }
            rows.push({ y, thick, first, end: ships.length });
            y += rowStep;
        }
        return { ships, rows };
    }

    function onRing(worldX, depth) {
        const rho = Math.hypot(worldX - VISTA.SLAB_WORLD_W / 2, depth - 1);
        return VISTA.RINGS.some(ring => Math.abs(rho - ring.r) < VISTA.RING_GAP);
    }

    /** One hull against whatever is behind it: a dark silhouette on bright light, a pale lit hull in the dark. */
    function paintFleetShip(b, ship, backdrop, isRead) {
        const onLight = backdrop > SILHOUETTE_OVER;
        const tone = isRead ? WHITE : onLight ? BLACK : DIM + (VIOLET - DIM) * ship.fade + backdrop * 0.5;
        const cap = isRead ? WHITE : onLight ? PALE : VIOLET + (PALE - VIOLET) * ship.fade;
        if (ship.turn === 0) drawHull(b, ship.x, ship.y, ship.len, ship.thick, tone, cap);
        else fillBox(b, ship.x + ship.len / 2, ship.y + ship.thick / 2, ship.len / 2, ship.thick / 2, Math.cos(ship.turn), Math.sin(ship.turn), tone, cap);
    }

    function buildVista(w, h, seed, H) {
        const L = vistaLayout(w, h), rand = H.rng(seed * 31 + 5);
        const still = { w, h, gray: new Float32Array(w * h), acc: new Float32Array(w * h), mask: new Uint8Array(w * h) };
        paintLight(still, L, H, rand);
        paintStars(still, L, rand);
        const light = Float32Array.from(still.gray);                     // the bare light, kept to judge hulls against
        const fleet = buildFleet(L, rand);
        fleet.ships.forEach(ship => paintFleetShip(still, ship, lightAt(light, L, ship), false));
        paintSlab(still, L);
        return { L, still, light, fleet };
    }

    function lightAt(light, L, ship) {
        const x = Math.min(L.w - 1, Math.max(0, ship.x + (ship.len >> 1))), y = Math.min(L.h - 1, Math.max(0, ship.y));
        return light[y * L.w + x];
    }

    /** The reading: one row at a time, a sheet of light that does not fall off, and every hull in it goes white. */
    function paintReading(b, scene, t) {
        const { L, fleet, light } = scene, rows = fleet.rows;
        const row = rows[(Math.floor(t / VISTA.BEAM_STEP_MS) + VISTA.BEAM_START) % rows.length];
        const y0 = Math.max(0, row.y - 1), y1 = Math.min(L.h, row.y + row.thick + 1);
        for (let y = y0; y < y1; y++) for (let x = 0; x < L.edgeX - 2; x++) {
            const i = y * L.w + x, beam = 0.34 + 0.4 * Math.exp(-(L.edgeX - x) / (L.w * 0.5));
            if (b.gray[i] < beam) b.gray[i] = beam;
        }
        for (let k = row.first; k < row.end; k++) paintFleetShip(b, fleet.ships[k], lightAt(light, L, fleet.ships[k]), true);
        fillRect(b, L.edgeX - 5, y0 - 1, 5 + L.edgeW + 3, y1 - y0 + 2, WHITE, 0);      // the notch on the edge where it is reading from
    }

    /** Rings of hulls, evenly spaced, turning against the river. Far side hidden by the slab, near side crossing its face. */
    function paintRings(b, scene, t) {
        const { L, light } = scene, centreX = VISTA.SLAB_WORLD_W / 2;
        VISTA.RINGS.forEach((ring, index) => {
            const count = Math.round(TAU * ring.r / VISTA.RING_PITCH), phase = -(t / ring.turn) * (count / 12) + index * 0.37;
            for (let k = 0; k < count; k++) {
                const a = (k + phase) * TAU / count, sinA = Math.sin(a), cosA = Math.cos(a);
                const depth = 1 + ring.r * sinA, worldX = centreX + ring.r * cosA;
                if (depth < 0.22) continue;
                const scale = 1 / depth, x = L.edgeX + worldX * L.focal * scale, y = L.horizonY + L.depthK * scale;
                if (x < -12 || x > L.w + 12 || y > L.h + 12) continue;
                if (depth > 1 && x > L.edgeX - 4 && x < L.edgeX + L.slabW + 1) continue;
                const tx = L.focal * (-ring.r * sinA * depth - worldX * ring.r * cosA) * scale * scale, ty = -L.depthK * ring.r * cosA * scale * scale;
                const norm = Math.hypot(tx, ty) || 1, stretch = Math.max(0.3, Math.min(1, norm / (L.focal * ring.r * scale * scale)));
                const halfLen = Math.max(0.6, VISTA.RING_HULL * L.unit * scale * stretch / 2), halfThick = Math.max(0.5, 0.7 * L.unit * scale);
                const px = Math.min(L.w - 1, Math.max(0, Math.round(x))), py = Math.min(L.h - 1, Math.max(0, Math.round(y)));
                const onLight = light[py * L.w + px] > SILHOUETTE_OVER, near = depth < 1;
                fillBox(b, x, y, halfLen, halfThick, tx / norm, ty / norm, onLight ? BLACK : near ? VIOLET : DIM + 0.06, onLight ? PALE : near ? WHITE : PALE);
            }
        });
    }

    /** The disc humanity threw away in 1977, held a hand's width off the lit edge. Gold: besides your engine, the only warm light there is. */
    function drawDisc(b, x, y, r, t) {
        const glint = Math.floor(t / 500) % 4 === 0;
        for (let dy = -r; dy <= r; dy++) {
            const half = r - Math.abs(dy);
            fillRect(b, x - half, y + dy, half * 2 + 1, 1, dy < 0 || glint ? WHITE : PALE, 1);
        }
        if (glint) { fillRect(b, x - r - 2, y, r * 2 + 5, 1, WHITE, 1); fillRect(b, x, y - r - 2, 1, r * 2 + 5, WHITE, 1); }
    }

    function paintLiving(b, scene, t) {
        const L = scene.L, scale = 1.95, len = Math.round(VISTA.HULL_LEN * 1.25 * L.unit * scale), thick = Math.max(2, Math.round(VISTA.HULL_THICK * L.unit * scale));
        drawLivingShip(b, L.edgeX + Math.round(L.slabW * 0.5), L.horizonY + Math.round(L.depthK * scale), len, thick, t);
        drawDisc(b, L.edgeX - Math.round(9 * L.unit), L.contactY - Math.round(26 * L.unit), Math.max(2, Math.round(2.4 * L.unit)), t);
    }

    const vistaCache = new Map();
    function renderVista(v, t, H) {
        const scene = remember(vistaCache, `${v.w}x${v.h}:${v.seed}`, () => buildVista(v.w, v.h, v.seed, H));
        v.gray.set(scene.still.gray); v.acc.fill(0); v.mask.fill(1);
        paintReading(v, scene, t);
        paintRings(v, scene, t);
        paintLiving(v, scene, t);
    }

    // ═════════════════════════════ THE BODY ═════════════════════════════
    const BODY = {
        EDGE_OFFSET: -0.16, SLAB_W: 0.46, SLAB_HALF_H: 1.2, RING_TILT: 0.3,
        RINGS: [{ r: 0.72, turn: 9000 }, { r: 1.0, turn: 13000 }, { r: 1.3, turn: 19000 }],
        FLEET_FROM: 32, LIVING_FROM: 60, BEAM_STEP_MS: 500,
    };

    function bodyLayout(s) {
        const R = s.R, edgeX = Math.round(s.cx + BODY.EDGE_OFFSET * R), slabW = Math.max(7, Math.round(BODY.SLAB_W * R));
        const halfH = Math.min(Math.floor(s.h / 2) - 1, Math.round(BODY.SLAB_HALF_H * R)), midY = Math.round(s.cy);
        return { w: s.w, h: s.h, R, edgeX, slabW, top: midY - halfH, bottom: midY + halfH, midY, edgeW: Math.max(2, Math.round(R * 0.045)), ringX: edgeX + slabW / 2 };
    }

    /** Violet light spilling off the lit edge, to the left only (unmasked: it glows over whatever is behind the body). */
    function paintBodyLight(b, L) {
        const reach = L.R * 1.22;
        for (let y = 0; y < L.h; y++) {
            const past = Math.max(0, L.top - y, y - L.bottom);
            for (let x = Math.max(0, Math.floor(L.edgeX - reach)); x < L.edgeX; x++) {
                const d = Math.hypot(L.edgeX - x, past * 2.2) / reach;
                if (d < 1) b.gray[y * L.w + x] = 0.56 * Math.pow(1 - d, 1.7);
            }
        }
    }

    function paintBodySlab(b, L) {
        const tall = L.bottom - L.top;
        fillRect(b, L.edgeX, L.top, L.slabW, tall, DIM, 0);               // a one-pixel rim of pure geometry…
        fillRect(b, L.edgeX, L.top + 1, L.slabW - 1, tall - 2, FACE, 0);  // …round one flat, noiseless face
        fillRect(b, L.edgeX, L.top, L.edgeW, tall, WHITE, 0);
    }

    function buildBodyFleet(L, rand) {
        const ships = [], rows = [], R = L.R;
        const rowStep = Math.max(3, Math.round(R * 0.085)), len = Math.max(2, Math.round(R * 0.055)), thick = Math.max(1, Math.round(R * 0.02));
        const pitch = len + Math.max(2, Math.round(R * 0.04)), span = Math.floor(R * 0.36 / rowStep);
        for (let j = -span; j <= span; j++) {
            const y = L.midY + j * rowStep - (thick >> 1), first = ships.length;
            for (let x = L.edgeX - 2 - pitch; x > L.edgeX - R * 1.3; x -= pitch) {
                const away = (L.edgeX - x) / R, chaos = smooth(0.62, 1.15, away + Math.abs(j) * 0.03);
                const rollSkip = rand(), rollX = rand(), rollY = rand(), rollTurn = rand();
                if (rollSkip < chaos * 0.55) continue;
                const sx = x + Math.round((rollX - 0.5) * pitch * chaos), sy = y + Math.round((rollY - 0.5) * R * 0.34 * chaos);
                const rho = Math.hypot(sx + len / 2 - L.ringX, (sy - L.midY) / BODY.RING_TILT) / R;
                if (BODY.RINGS.some(ring => Math.abs(rho - ring.r) < 0.07)) continue;
                ships.push({ x: sx, y: sy, len, thick, turn: chaos > 0.3 ? (rollTurn - 0.5) * 2.4 * chaos : 0, fade: 1 - 0.6 * chaos });
            }
            rows.push({ y, thick, first, end: ships.length });
        }
        return { ships, rows };
    }

    function buildBody(s, H) {
        const L = bodyLayout(s), still = { w: s.w, h: s.h, gray: new Float32Array(s.w * s.h), acc: new Float32Array(s.w * s.h), mask: new Uint8Array(s.w * s.h) };
        paintBodyLight(still, L);
        const light = Float32Array.from(still.gray);
        const fleet = L.R >= BODY.FLEET_FROM ? buildBodyFleet(L, H.rng(s.seed * 17 + 3)) : { ships: [], rows: [] };
        fleet.ships.forEach(ship => paintFleetShip(still, ship, lightAt(light, L, ship) + 0.12, false));
        return { L, still, light, fleet };
    }

    function paintBodyReading(b, scene, t) {
        const { L, fleet, light } = scene, step = Math.floor(t / BODY.BEAM_STEP_MS);
        let y0, y1;
        if (fleet.rows.length) {
            const row = fleet.rows[(step + 2) % fleet.rows.length];
            y0 = row.y - 1; y1 = row.y + row.thick + 1;
            for (let k = row.first; k < row.end; k++) paintFleetShip(b, fleet.ships[k], lightAt(light, L, fleet.ships[k]), true);
        } else {
            const lanes = 5, gap = Math.max(2, Math.round(L.R * 0.16));
            y0 = L.midY + ((step + 2) % lanes - 2) * gap; y1 = y0 + 1;
        }
        const reach = L.R * 1.25;
        for (let y = Math.max(0, y0); y < Math.min(L.h, y1); y++) for (let x = Math.max(0, Math.floor(L.edgeX - reach)); x < L.edgeX; x++) {
            const i = y * L.w + x;
            if (b.mask[i]) continue;
            b.gray[i] = Math.max(b.gray[i], 0.3 + 0.4 * (1 - (L.edgeX - x) / reach));
        }
    }

    function paintBodyRings(b, scene, t, behind) {
        const { L, light } = scene, R = L.R, rings = R < BODY.FLEET_FROM ? [BODY.RINGS[0], BODY.RINGS[2]] : BODY.RINGS;
        const hull = Math.max(2, R * 0.075), halfThick = Math.max(0.5, R * 0.011);
        rings.forEach((ring, index) => {
            const count = Math.round(TAU * ring.r * R / (hull * 2.1)), phase = -(t / ring.turn) * (count / 12) + index * 0.37;
            for (let k = 0; k < count; k++) {
                const a = (k + phase) * TAU / count, sinA = Math.sin(a), cosA = Math.cos(a);
                if ((sinA < 0) !== behind) continue;
                const x = L.ringX + ring.r * R * cosA, y = L.midY + ring.r * R * BODY.RING_TILT * sinA;
                const tx = -sinA, ty = BODY.RING_TILT * cosA, norm = Math.hypot(tx, ty);
                const px = Math.min(L.w - 1, Math.max(0, Math.round(x))), py = Math.min(L.h - 1, Math.max(0, Math.round(y)));
                const onLight = light[py * L.w + px] + 0.12 > SILHOUETTE_OVER, grow = behind ? 1 : 1.25;
                fillBox(b, x, y, Math.max(0.5, hull * norm * grow / 2), halfThick * grow, tx / norm, ty / norm, onLight ? BLACK : behind ? VIOLET : PALE, onLight ? PALE : behind ? PALE : WHITE);
            }
        });
    }

    const bodyCache = new Map();
    function render(s, t, H) {
        const scene = remember(bodyCache, `${s.w}x${s.h}:${s.R}:${s.seed}`, () => buildBody(s, H)), L = scene.L;
        s.gray.set(scene.still.gray); s.acc.set(scene.still.acc); s.mask.set(scene.still.mask);
        paintBodyReading(s, scene, t);
        paintBodyRings(s, scene, t, true);
        paintBodySlab(s, L);
        paintBodyRings(s, scene, t, false);
        if (L.R >= BODY.LIVING_FROM) drawDisc(s, L.edgeX - Math.round(L.R * 0.09), L.midY - Math.round(L.R * 0.3), Math.max(2, Math.round(L.R * 0.022)), t);
        if (L.R >= BODY.LIVING_FROM) drawLivingShip(s, L.edgeX + Math.round(L.slabW * 0.3), L.midY + Math.round(L.R * 0.66), Math.max(6, Math.round(L.R * 0.075)), Math.max(2, Math.round(L.R * 0.022)), t);
    }

    window.StructureArt = { look: LOOK, render, renderVista };
})();
