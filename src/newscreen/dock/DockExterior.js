/* ═══ Silent Exodus · new screen (?new=1) · dock/DockExterior.js: the film cut at the dock ════════════════════════════
   Bring Her In (prototypes/ideas/bring-her-in, "level it up", approved 2026-10-23): the film cut at the dock.
   The player flies every metre from the bridge glass; at the touch the picture cuts to a camera outside and shows the
   last seconds again (the flight's own track, replayed: an overlapping cut, as a film does it), then the grade. The
   station is drawn big: its ring (twenty-four segments, rows of dead windows, a few lit), six spokes with their panel
   wings (some panels gone, the far ring showing through), the hub with the stub of its snapped mast, our own class's
   dead hulls far behind it, wheeling with the sky. Our Lander is small against it (the game's own hull: NSPaint.hull +
   shapeL, as SeaArt's ourSprite paints it, its tail end and its rim lit), its shadow lying across the ring, sliding the
   last metres down into the port: a collar with a recessed bay, a dark door in a thin lit frame. A soft dock: the clamps
   close, the bay's light drops to a thin warm seal, then the station's lights come on round the ring. A rough one knocks
   the port's rim (sparks, a shudder, a scorch that stays and a slow vent) and the fourth clamp catches late. A hard one
   strikes and bounces off, a panel tumbling away, and the clamps take it on the second try; the torn decks, the drifting
   pieces and a dark arc of lights stay. A second camera at the port, from the same side, takes the clamps close up; the
   wide takes the glide, a strike's bounce and the ring's lights. The cameras turn with the ring, so the station holds
   still and the sky wheels behind it (the flight draws the sky, then this lays the rest over it). Every moving effect
   is drawn at its camera's scale (FX).
   The station is ray-marched once (bake, a few milliseconds a frame during the run-up) into its own pixel layer: per art
   pixel, the ramp step for its tone (8 x 8 Bayer), with one light from the upper left, soft shadows, a little occlusion
   in the corners and a one-pixel rim where an edge faces the light (docs/ART_STYLE.md).
   Loaded only when the new-screen switch is on (index.html), after art/Paint.js (it needs NSPaint when it loads).
     const ext = DockExterior.create(AW, AH, 'wide' | 'close')
     ext.bake(ms)           work on the station for about ms; true once it is done (ext.bake(Infinity) finishes it)
     ext.reset()            a new cut: the strike's sparks and pieces are worked out again
     ext.beats(grade)       the grade's beats in seconds after the touch: { lock, lights, events: [[at, kind]] }
     ext.draw(buf, f)       lay frame f over the sky already in buf (Uint32 pixels, AW x AH):
                            f = { te (s since the cut), touch (te of the touch, or -1 while still closing), grade,
                                  s (metres above the port, until the touch), lat (-1..1: how far off the port), tilt (-1..1:
                                  how unmatched the roll), drive (0..1), brake, lined (0..1: the port's lamps), ox, oy (the
                                  shake, art px), broke (a deck index 0..5 broken in the strike, or -1), holes (decks broken
                                  before it), lit (decks lit from inside), turn (rad the sky has wheeled since the cut),
                                  calm }   lat and tilt: the replayed track until the touch, then as they were at it
     ext.debug()            what the last frame showed (for the headless checks)
     DockExterior.shotAt(grade, since, s)   which camera the edit wants (the wide for the glide, a strike and its bounce;
                            the close for the last metre of a soft one and for the clamps; the wide again for the lights)
   LAST PORT (prototypes/ideas/last-port, approved 2026-10-31): create(AW, AH, shot, relay) with relay (window.DockRelay.exterior)
   docks at the dark moon's relay instead: three of our own class stand clamped in the ring's other ports beside ours,
   nose in, crooked in their clamps (relay.sag), dark (the game's Lander sprite, rusted); no lights wake round the ring.
   From the lock the close camera holds all four of us: our windows lit, then each dead hull's, deck by deck, one hull
   after another, slowly; then the small screen set into the ring beside our collar, dark glass until then, says SENT
   (three slow blinks, then held). A hard dock tears the nearest one on the side we struck loose: it falls away towards
   the moon (f.relay.moon), its windows dark, its berth left empty. beats(grade).relay and shotAt(grade, since, s, relay)
   give the cut's last beats and its edit (a third camera, the mid, only for a hard dock's bounce). Each camera keeps its
   own station (the dead ports' collars). Without relay nothing here changes. */
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!P) return;
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v), clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k;
    const ease = k => { k = clamp01(k); return k * k * (3 - 2 * k); }, easeOut = k => 1 - (1 - clamp01(k)) ** 3;
    const hash = (a, b, s) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

    // ── the ramps (the travel view's, NSPaint.RP, plus the flight's COLD and WARM), as 32-bit pixels ──
    const ramp = r => ({ n: r.rgb.length, c32: Uint32Array.from(r.rgb.map(([a, b, c]) => (0xff000000 | (c << 16) | (b << 8) | a) >>> 0)), lum: r.rgb.map(([a, b, c]) => (a * 77 + b * 150 + c * 29) >> 8) });
    const RP = P.RP, R = {
        HULL: ramp(RP.HULL), PANEL: ramp(RP.UI), AMBER: ramp(RP.AMBER), SUN: ramp(RP.SUN), PLUME: ramp(RP.PLUME), STAR: ramp(RP.STAR),
        RUST: ramp(RP.RUST), RED: ramp(RP.RED), ICE: ramp(RP.ICE),
        COLD: ramp(P.ramp(P.INK, '#141f29', '#355468', '#7fa5bc', '#d6e9f2')), WARM: ramp(P.ramp(P.INK, '#2a1f14', '#6a4b2c', '#b48650', '#efcf9c')),
    };
    const B8 = Float32Array.from({ length: 64 }, (_, i) => P.threshold(i & 7, i >> 3));
    const level = (r, v, x, y) => { const pos = clamp01(v) * (r.n - 1), lo = pos | 0; return Math.min(r.n - 1, pos - lo > B8[((y & 7) << 3) | (x & 7)] ? lo + 1 : lo); };
    const lum32 = p => ((p & 255) * 77 + ((p >> 8) & 255) * 150 + ((p >> 16) & 255) * 29) >> 8;

    // ── the station, in its own frame: the axis is z (its face, where the ports are, looks along +z); units are metres-ish ──
    // the ring and its tube; the port's place round it (straight down in the picture); the docking collar standing off the
    // ring's face (half-width, its face's height and its foot in z) with the lit bay and the dark door in its face; the hub
    // (a drum and a dome, a collar where the spokes meet it, the spine behind) and its snapped mast; six spokes, the first
    // under the port, each carrying a wing of panels either side (cells [along, across], the share of them gone).
    const RM = 100, RT = 14, PU = -Math.PI / 2, PC = Math.cos(PU), PS = Math.sin(PU);
    // the collar and its bay: the recess (half-width, depth), the dark door in its floor and the thin lit frame round it
    const COL = { half: 3.6, top: RT + 1.8, foot: RT - 4.5 }, BAY = { half: 2.5, deep: 0.55, door: 1.15, frame: 0.3, fall: 0.42 };
    const HUB = { r: 17, z0: -34, z1: 8 }, SPINE = { r: 7.5, z0: -58 }, MAST = { a: [0, 0, 8 + 17 - 0.5], b: [3.2, 1.6, 8 + 17 + 9], r: 0.9 };
    const SPOKE = { r: 2.4, from: 15, to: RM - RT + 1.5, step: Math.PI / 3 }, WING = { at: 51, half: 21, w: 7, gap: 0.9, th: 0.25, z: -0.6, cell: [3.5, 2.35], gone: 0.12 };
    const SC = [0, 1, 2, 3, 4, 5].map(k => Math.cos(PU + k * SPOKE.step)), SS = [0, 1, 2, 3, 4, 5].map(k => Math.sin(PU + k * SPOKE.step));
    const SKIN = { hatch: 0.16, grime: 0.22 };                            // the share of plates with a hatch; how dark the grime gets
    // the windows: rows round the tube; a few lit; the share that wake with the lights, in the segments that wake at all
    const SEGS = 24, WIN = { step: 3.1, w: 0.72, h: 0.5, frame: 0.24, rows: [-0.3, 0.3, Math.PI - 0.3, Math.PI + 0.3], lit: 0.05, wake: 0.6, deadSeg: 0.35 };
    // our Lander: its diameter and length (the travel view's proportions, 1 : 3.15), small against a ring 228 m across;
    // how far its nose sits down in the bay once home; and the dead hulls far behind the station [x, y in the picture
    // (shares of its size), length (art px), angle, from, to], wheeling with the sky (sprites every DEAD_STEP rad)
    const LANDER = { d: 3.2, len: 3.2 * 3.15, seat: 0.4 };
    const DEAD = [[0.86, 0.17, 40, 2.55, 0, 0.56], [0.95, 0.27, 17, 2.1, 0.62, 1], [0.93, 0.9, 13, 0.9, 0, 1]], DEAD_STEP = 0.035;
    // the two cameras: the wide (the whole station, our Lander small at its port, a little sky above the ring) and the
    // close (at the port, from the same side, so the cut between them keeps our direction): where each is, what it looks
    // at, focal length (art px), roll (a dutch angle). The close takes the last CLOSE_AT metres of a soft approach.
    const CAMS = {
        wide: { pos: [-73.5, -RM - 87.5, 100.25], at: [0, -30, -10], f: 520, roll: 0.5, shift: 12 },
        close: { pos: [-27, -131, 47], at: [2, -96, 18], f: 520, roll: 0.5 },
    };
    // LAST PORT (relay only): a third camera, nearer than the wide, on the row of hulls by our port (the windows beat)
    const CAM_MID = { pos: [-31.5, -147.5, 63.5], at: [12, -95, 20], f: 520, roll: 0.42 };
    const RELAY_CHUNK = 96;                                                  // (and its bake looks at the clock every this many pixels, not every row)
    const CLOSE_AT = 1.3, HOLD_CLOSE = 1.3;      // and a rough or hard dock goes back to the close HOLD_CLOSE s into the ring's lights, to hold on what it broke
    const LIGHT = [-0.75, 0.3, 0.42];                                       // in the station's frame: in the picture, from the upper left and a little in front
    const SHADE = { amb: 0.05, pow: 1.15, gain: 0.8, fade: 0.36, shine: 22, spec: 0.46 };                    // the dark side's floor; how the light falls off; the far side dimmer
    const T_HIT = 0.55, MAX_STEPS = 140, SHADOW_STEPS = 40;

    const box3 = (x, y, z, hx, hy, hz) => {
        const qx = Math.abs(x) - hx, qy = Math.abs(y) - hy, qz = Math.abs(z) - hz;
        const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
        return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0);
    };
    let useWings = true;                                                   // false once a ray has gone through a gap in a wing
    function hubD(x, y, z, q) {
        if (q > 25) return q - 21;                                         // a lower bound, far from the axis
        const dr = q - HUB.r, dz = Math.max(HUB.z0 - z, z - HUB.z1);
        let d = dr > 0 && dz > 0 ? Math.sqrt(dr * dr + dz * dz) : Math.max(dr, dz);
        const zd = z - HUB.z1; d = Math.min(d, Math.sqrt(q * q + zd * zd) - HUB.r);                       // the dome
        const cq = q - HUB.r - 0.6; d = Math.min(d, Math.sqrt(cq * cq + z * z) - 3.1);                      // the collar
        const sr = q - SPINE.r, sz = Math.max(SPINE.z0 - z, z - HUB.z0 - 2);                                // the spine
        d = Math.min(d, sr > 0 && sz > 0 ? Math.sqrt(sr * sr + sz * sz) : Math.max(sr, sz));
        const [ax, ay, az] = MAST.a, bx = MAST.b[0] - ax, by = MAST.b[1] - ay, bz = MAST.b[2] - az;       // the mast's stub
        const px = x - ax, py = y - ay, pz = z - az, h = clamp01((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz));
        return Math.min(d, Math.hypot(px - bx * h, py - by * h, pz - bz * h) - MAST.r);
    }
    function spokeD(x, y, z) {
        let k = Math.round((Math.atan2(y, x) - PU) / SPOKE.step) % 6; if (k < 0) k += 6;
        const c = SC[k], s = SS[k], sx = x * c + y * s, sy = Math.abs(-x * s + y * c);
        const cl = sx < SPOKE.from ? SPOKE.from : sx > SPOKE.to ? SPOKE.to : sx, ex = sx - cl;
        const d = Math.sqrt(ex * ex + sy * sy + z * z) - SPOKE.r;
        return useWings ? Math.min(d, box3(sx - WING.at, sy - (SPOKE.r + WING.gap + WING.w / 2), z - WING.z, WING.half, WING.w / 2, WING.th)) : d;
    }
    /** The docking collar: a block standing off the ring's face, its bay a square recess in its top. */
    const collarD = (x, y, z) => {
        const lt = x * -PS + y * PC, lr = x * PC + y * PS - RM;
        return Math.max(box3(lt, lr, z - (COL.top + COL.foot) / 2, COL.half, COL.half, (COL.top - COL.foot) / 2), -box3(lt, lr, z - COL.top, BAY.half, BAY.half, BAY.deep));
    };
    // LAST PORT (relay): the dead ports' collars round the ring, the same block as ours at their own angles (set by create)
    let EXTRA = [];
    const collarAt = (x, y, z, pc, ps) => {
        const lt = x * -ps + y * pc, lr = x * pc + y * ps - RM;
        return Math.max(box3(lt, lr, z - (COL.top + COL.foot) / 2, COL.half, COL.half, (COL.top - COL.foot) / 2), -box3(lt, lr, z - COL.top, BAY.half, BAY.half, BAY.deep));
    };
    /** The nearest dead collar, or d0 if none is nearer (a collar further along the ring than d0 is never measured). */
    const extraD = (x, y, z, d0 = Infinity) => {
        let d = d0;
        for (let k = 0; k < EXTRA.length; k++) { const e = EXTRA[k]; if (Math.abs(x * -e.s + y * e.c) - COL.half < d) d = Math.min(d, collarAt(x, y, z, e.c, e.s)); }
        return d;
    };
    /** The dead port whose collar a point is on (nearer its angle than ours), or null. */
    const deadCollarOf = (x, y) => { const a = Math.atan2(y, x); let best = null, bd = Math.abs(wrapA(a - PU)); EXTRA.forEach(e => { const dd = Math.abs(wrapA(a - PU - e.d)); if (dd < bd) { bd = dd; best = e; } }); return best; };
    function sdf(x, y, z) {
        const q = Math.sqrt(x * x + y * y), tq = q - RM;
        let d = Math.sqrt(tq * tq + z * z) - RT;
        d = Math.min(d, collarD(x, y, z), hubD(x, y, z, q));
        if (EXTRA.length && Math.max(Math.abs(q - RM) - COL.half * 1.5, COL.foot - z, z - COL.top) < d) d = extraD(x, y, z, d);   // (only near the collars' band: further off, no collar can be nearer than d)
        if (q > HUB.r - 4 && q < RM - RT + 4) d = Math.min(d, Math.abs(z) > 4 ? Math.abs(z) - 2.6 : spokeD(x, y, z));
        return d;
    }
    const M_RING = 1, M_COLLAR = 2, M_HUB = 3, M_SPOKE = 4, M_WING = 5, M_MAST = 6;
    /** Which part is at a point on the surface (the nearest), with the spoke frame it was found in. */
    function partAt(x, y, z) {
        const q = Math.sqrt(x * x + y * y), tq = q - RM, list = [[Math.sqrt(tq * tq + z * z) - RT, M_RING], [collarD(x, y, z), M_COLLAR]];
        if (EXTRA.length) list.push([extraD(x, y, z), M_COLLAR]);
        if (q < 25) {
            const [ax, ay, az] = MAST.a, bx = MAST.b[0] - ax, by = MAST.b[1] - ay, bz = MAST.b[2] - az, px = x - ax, py = y - ay, pz = z - az;
            const h = clamp01((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz));
            list.push([Math.hypot(px - bx * h, py - by * h, pz - bz * h) - MAST.r, M_MAST], [hubD(x, y, z, q) + 0.02, M_HUB]);
        }
        if (q > HUB.r - 4 && q < RM - RT + 4 && Math.abs(z) < 4) {
            const sp = spokeD(x, y, z);
            const wasWing = useWings; useWings = false; const bare = spokeD(x, y, z); useWings = wasWing;
            list.push([bare, M_SPOKE]); if (sp < bare - 1e-4) list.push([sp, M_WING]);
        }
        return list.reduce((a, b) => (b[0] < a[0] ? b : a))[1];
    }

    // ── the camera ──
    const norm = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    function camera(AW, AH, CAM) {
        const fw = norm([CAM.at[0] - CAM.pos[0], CAM.at[1] - CAM.pos[1], CAM.at[2] - CAM.pos[2]]);
        let rt = norm(cross(fw, [0, 0, 1])), up = cross(rt, fw);
        const c = Math.cos(CAM.roll), s = Math.sin(CAM.roll);
        [rt, up] = [rt.map((v, i) => v * c + up[i] * s), up.map((v, i) => v * c - rt[i] * s)];
        const L = norm(LIGHT);
        const cx = AW / 2, cy = AH / 2 + (CAM.shift || 0) * AH / 405, O = CAM.pos, F = CAM.f;   // shift: the picture moved down (a lens shift, art px)
        /** A point → [x, y] art px and its distance from the camera (or null behind it). */
        const project = p => {
            const d = [p[0] - O[0], p[1] - O[1], p[2] - O[2]], z = dot(d, fw);
            if (z < 1) return null;
            return [cx + F * dot(d, rt) / z, cy - F * dot(d, up) / z, Math.hypot(d[0], d[1], d[2])];
        };
        return { fw, rt, up, L, cx, cy, O, F, project };
    }

    // ── the bake: one ray per art pixel, a few rows at a time ──
    function marchRay(ox, oy, oz, dx, dy, dz, F) {
        // the station's bounds: a sphere round it (ring, hub and spine)
        const cz = -18, bR = RM + RT + 8, bx = ox, by = oy, bz = oz - cz, b = bx * dx + by * dy + bz * dz, c = bx * bx + by * by + bz * bz - bR * bR, disc = b * b - c;
        if (disc < 0) return -1;
        const sq = Math.sqrt(disc), t1 = -b + sq;
        let t = Math.max(0.5, -b - sq);
        for (let i = 0; i < MAX_STEPS && t < t1; i++) {
            const d = sdf(ox + dx * t, oy + dy * t, oz + dz * t);
            if (d < T_HIT * t / F) return t;
            t += d;
        }
        return -1;
    }
    function normalAt(x, y, z, e) {
        const a = sdf(x + e, y - e, z - e), b = sdf(x - e, y - e, z + e), c = sdf(x - e, y + e, z - e), d = sdf(x + e, y + e, z + e);
        return norm([a - b - c + d, -a - b + c + d, -a + b - c + d]);
    }
    function shadowAt(x, y, z, L) {
        let res = 1, t = 0.8;
        for (let i = 0; i < SHADOW_STEPS && t < 240; i++) {
            const h = sdf(x + L[0] * t, y + L[1] * t, z + L[2] * t);
            if (h < 0.03) return 0;
            res = Math.min(res, 10 * h / t);
            t += Math.min(14, Math.max(0.35, h));
        }
        return clamp01(res);
    }
    function occlusionAt(x, y, z, n) {
        let occ = 0, w = 1;
        for (let i = 1; i <= 4; i++) { const h = 0.7 * i * i; occ += (h - sdf(x + n[0] * h, y + n[1] * h, z + n[2] * h)) * w; w *= 0.55; }
        return clamp01(1 - occ * 0.09);
    }
    const wrapA = a => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
    const frac = v => v - Math.floor(v);

    /** One surface point's look, into out: { r ramp, v tone, glow (true: it gives its own light, the light and shadow do
        not touch it), wake (a dark window that lights when the lights come on: its angle from the port, else -1), bay (the
        bay's lit parts, which dim once we are home: 0 its floor and walls, 1 the lit frame, else -1) }. Here only the
        part's own pattern (plates and seams, windows, the bay, bands); the caller lights it. */
    const look = (out, r, v, glow) => { out.r = r; out.v = v; out.glow = !!glow; };
    function surface(mat, x, y, z, n, out) {
        out.wake = -1; out.bay = -1;
        if (mat === M_RING) { ringSurface(x, y, z, out); return; }
        if (mat === M_COLLAR) { collarSurface(x, y, z, n, out); return; }
        if (mat === M_HUB) {
            const q = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
            if (z < HUB.z1 && q > HUB.r - 0.4) {                                                              // the drum: bands and panels
                if (Math.abs(z - 1) < 1.3 && Math.abs(wrapA(4 * a - Math.PI)) < 0.32) { look(out, R.PANEL, 0.6, true); return; }   // four cold windows
                const band = frac((z - HUB.z0) / 6.5) < 0.08, rib = frac(a / (Math.PI / 10)) < 0.06;
                look(out, R.HULL, (band ? 0.5 : rib ? 0.68 : 0.88) + 0.16 * (P.fbm(a * 8, z / 5, 23, 2) - 0.5));
                return;
            }
            if (z > HUB.z1) { const ring = frac(Math.atan2(q, z - HUB.z1) / 0.3) < 0.07, gore = frac(a / (Math.PI / 6)) < 0.03; look(out, R.HULL, ring || gore ? 0.55 : 0.92); return; }   // the dome
            look(out, R.HULL, 0.7);                                                                            // the collar, the spine
            return;
        }
        if (mat === M_SPOKE) { look(out, R.HULL, frac(Math.sqrt(x * x + y * y) / 7) < 0.1 ? 0.45 : 0.8); return; }
        look(out, R.HULL, 0.78);
    }
    /** The collar: its top a steel plate with a lip at its edge and round the bay, the clamps' sockets in its corners; the
        bay's floor dark steel warmed by the thin lit frame round the dark door (two leaves), the light falling off into
        the recess; its walls in the frame's light; the collar's sides with one band. */
    function collarSurface(x, y, z, n, out) {
        if (EXTRA.length) { const e = deadCollarOf(x, y); if (e) { deadCollarSurface(x, y, z, n, out, e); return; } }
        const lt = x * -PS + y * PC, lr = x * PC + y * PS - RM, m = Math.max(Math.abs(lt), Math.abs(lr)), up = n[2] > 0.7;
        if (up && z < COL.top - BAY.deep * 0.5 && m < BAY.half + 0.05) {                                    // the bay's floor
            if (m < BAY.door) { look(out, R.HULL, m > BAY.door - 0.14 ? 0.3 : Math.abs(lt) < 0.06 ? 0.13 : 0.03, true); return; }
            if (m < BAY.door + BAY.frame) { look(out, R.AMBER, 0.86, true); out.bay = 1; return; }
            look(out, R.AMBER, 0.1 + 0.36 * Math.exp(-(m - BAY.door - BAY.frame) / BAY.fall), true); out.bay = 0;
            return;
        }
        if (!up && z > COL.top - BAY.deep - 0.05 && m < BAY.half + 0.03) { look(out, R.AMBER, 0.2, true); out.bay = 0; return; }   // the recess walls
        if (up) {
            const c = COL.half - m, sock = Math.abs(Math.abs(lt) - (COL.half - 0.55)) < 0.3 && Math.abs(Math.abs(lr) - (COL.half - 0.55)) < 0.3;
            look(out, R.HULL, sock ? 0.28 : c < 0.28 ? 1.05 : m < BAY.half + 0.22 ? 0.98 : 0.8 + 0.1 * (hash(Math.floor(lt / 1.2) + 9, Math.floor(lr / 1.2) + 9, 5) - 0.5));
            return;
        }
        look(out, R.HULL, z > COL.top - 1.4 && z < COL.top - 1.0 ? 0.45 : 0.82);
    }
    /** LAST PORT: a dead port's collar: the same plate and lip, its bay and door dark steel (a hull's nose sits in it). */
    function deadCollarSurface(x, y, z, n, out, e) {
        const lt = x * -e.s + y * e.c, lr = x * e.c + y * e.s - RM, m = Math.max(Math.abs(lt), Math.abs(lr)), up = n[2] > 0.7;
        if (up && z < COL.top - BAY.deep * 0.5 && m < BAY.half + 0.05) { look(out, R.HULL, m < BAY.door ? 0.05 : 0.16); return; }
        if (!up && z > COL.top - BAY.deep - 0.05 && m < BAY.half + 0.03) { look(out, R.HULL, 0.12); return; }
        if (up) { const c = COL.half - m; look(out, R.HULL, c < 0.28 ? 1.0 : m < BAY.half + 0.22 ? 0.9 : 0.76 + 0.1 * (hash(Math.floor(lt / 1.2) + 19, Math.floor(lr / 1.2) + 9, 7) - 0.5)); return; }
        look(out, R.HULL, z > COL.top - 1.4 && z < COL.top - 1.0 ? 0.45 : 0.78);
    }
    /** The ring's skin: twenty-four segments with dark joints, plates and their seams, weathering; rows of
        windows on its outer and inner walls, nearly all dead (dark slots), a few lit warm, some that wake with the lights
        (whole segments of them stay dark: the station is not all alive). */
    function ringSurface(x, y, z, out) {
        const q = Math.sqrt(x * x + y * y), u = wrapA(Math.atan2(y, x) - PU), v = Math.atan2(z, q - RM), su = u * RM, arc = u * q;
        const segA = 2 * Math.PI / SEGS, seg = frac(u / segA + 0.5), jd = Math.min(seg, 1 - seg) * segA * q;
        const plate = Math.floor(arc / 4.2) * 13 + Math.floor((v + Math.PI) / 0.52);
        let tone = 0.84 + 0.1 * (hash(plate, 3, 11) - 0.5) + 0.24 * (P.fbm(su / 22 + 40, v * 2.3, 17, 3) - 0.5);
        if (jd < 0.6) tone *= 0.38; else if (jd < 1.2) tone *= 1.1;                                           // the joint and its lip
        else if (frac(arc / 4.2) < 0.05 || frac((v + Math.PI) / 0.52) < 0.06) tone *= 0.78;                   // plate seams
        else {
            const pa = frac(arc / 4.2), pv = frac((v + Math.PI) / 0.52), ph = hash(plate, 9, 41);
            if (hash(plate, 5, 13) < 0.5 && (frac(arc / 1.4) < 0.035 || Math.abs(pv - 0.5) < 0.025)) tone *= 0.86;   // a plate cut in panels
            if (ph < SKIN.hatch && pa > 0.3 && pa < 0.7 && pv > 0.28 && pv < 0.72) {                              // a hatch: its upper lip in shade, its sill lit
                const ea = Math.min(pa - 0.3, 0.7 - pa) * 4.2, ev = Math.min(pv - 0.28, 0.72 - pv) * 0.52 * RT;
                tone *= ea < 0.14 || ev < 0.14 ? (pv < 0.5 ? 0.58 : 1.12) : 0.93;
            }
        }
        tone *= 1 - SKIN.grime * P.fbm(arc / 1.3, v * 4.5 + 7, 29, 3);                                         // grime, along the arc
        for (let r = 0; r < WIN.rows.length; r++) {                                                           // the windows
            const dv = wrapA(v - WIN.rows[r]) * RT;
            if (Math.abs(dv) > WIN.h + WIN.frame) continue;
            const wi = Math.round(arc / WIN.step), da = arc - wi * WIN.step;
            if (Math.abs(da) > WIN.w + WIN.frame || jd < 1.4) continue;
            if (Math.abs(da) > WIN.w || Math.abs(dv) > WIN.h) { look(out, R.HULL, tone * (dv > 0 === (r < 2) ? 0.62 : 1.08)); return; }   // its frame: shade above, a lit sill
            if (hash(wi, r, 31) < WIN.lit) { look(out, R.WARM, 0.5 + 0.3 * hash(wi, r, 7), true); return; }        // a few lit: someone, somewhere
            const sk = Math.round(u / segA) + 40, inSeg = frac(u / segA + 0.5), b0 = 0.1 + 0.5 * hash(sk, r, 61), b1 = b0 + 0.15 + 0.3 * hash(sk, r, 67);   // a block of rooms in the segment
            if (hash(sk, r, 77) > WIN.deadSeg && inSeg > b0 && inSeg < b1 && hash(wi, r, 53) < WIN.wake) out.wake = Math.abs(u);   // dead, until the lights come on
            look(out, R.HULL, 0.03, true);
            return;
        }
        look(out, R.HULL, tone);
    }
    /** A wing's cell at a point: [ramp, tone, glow], or null where the cell has gone (the ray goes on through). */
    function wingAt(x, y, z, view, L) {
        let k = Math.round((Math.atan2(y, x) - PU) / SPOKE.step) % 6; if (k < 0) k += 6;
        const c = SC[k], s = SS[k], sx = x * c + y * s, syS = -x * s + y * c, side = syS < 0 ? 0 : 1, sy = Math.abs(syS) - SPOKE.r - WING.gap;
        const ca = (sx - WING.at + WING.half) / WING.cell[0], cb = sy / WING.cell[1], ia = Math.floor(ca), ib = Math.floor(cb), id = ia + k * 40 + side * 20;
        const frame = frac(ca) < 0.1 || frac(cb) < 0.12 || sy > WING.w - 0.22 || sy < 0.18;
        if (!frame && hash(id, ib, 71) < WING.gone) return null;
        if (frame) return [R.HULL, 0.75, false];
        const nz = z > WING.z ? 1 : -1, glint = L[2] * nz > 0 ? Math.pow(Math.max(0, view[0] * L[0] + view[1] * L[1] - view[2] * L[2]), 16) : 0;   // the view mirrored in the cell
        return glint > 0.3 ? [R.PANEL, 0.6 + 0.4 * glint, true] : [R.PANEL, 0.82 + 0.22 * hash(id, ib, 5), false];
    }

    // ── the shot's beats, in seconds after the touch: soft, a little give and the clamps draw it in; rough, it knocks the
    //    rim and scrapes into place, the fourth clamp catching late; hard, it strikes, bounces off and comes back ──
    const BEATS = {
        soft: { pull: 0.45, clamp: 0.2, clampT: 0.5, lock: 0.95, lights: 1.75 },
        rough: { seat: 0.65, clamp: 0.25, clampT: 0.3, late: 1.45, lock: 1.6, lights: 2.4 },
        crash: { peak: 0.95, back: 2.7, clamp: 2.8, clampT: 0.3, lock: 3.2, lights: 4.0, bounce: 9 },
    };
    /** The edit: which camera, `since` s after the touch (< 0 during the replay, s metres out). The wide for the glide,
        a strike and its bounce; the close for the last metre of a soft one, for a rough one's scrape from the touch and
        for the clamps; the wide again a moment before the ring's lights; a rough or hard one back to the close for what it left. */
    /** LAST PORT: the cut's last beats, from the lock, all on the close (it holds the four of us in a row, our windows lit,
        and the screen): A.U.R.A.'s grade line as the clamps lock (said by the flight); then each dead hull's windows in
        turn, slowly; then the screen's SENT (dark glass until then); Mira's line after SENT has had the frame to itself;
        the chips under it, silently. */
    function relayBeats(grade) {
        const L = (BEATS[grade] || BEATS.soft).lock;
        return { lock: L, report: L + 0.3, wins: [L + 1.6, L + 2.95, L + 4.3], sent: L + 5.8, mira: L + 8.7, chips: L + 10.5 };   // (Mira once the word holds)
    }
    /** LAST PORT, the edit: the wide for the glide (the close for a soft one's last metre); from the touch the close, but
        a hard one's strike wide and its bounce (and the hull it tears loose) on the mid. */
    function relayShot(grade, since, s) {
        const b = BEATS[grade] || BEATS.soft;
        if (since < 0) return grade === 'soft' && s < CLOSE_AT ? 'close' : 'wide';
        if (grade === 'crash' && since < b.back - 0.4) return since >= 0.9 ? 'mid' : 'wide';
        return 'close';
    }
    function shotAt(grade, since, s, relay) {
        if (relay) return relayShot(grade, since, s);
        const b = BEATS[grade] || BEATS.soft;
        if (since < 0) return grade === 'soft' && s < CLOSE_AT ? 'close' : 'wide';
        if (grade !== 'soft' && since >= b.lights + HOLD_CLOSE) return 'close';
        if (since >= b.lights - 0.25) return 'wide';
        if (grade === 'crash') return since >= b.back - 0.4 ? 'close' : 'wide';
        return 'close';
    }

    function create(AW, AH, shot, relay) {
        const RX = relay || null;                                            // LAST PORT
        const ownExtra = RX && RX.ports ? RX.ports.map(d => ({ d, c: Math.cos(PU + d), s: Math.sin(PU + d) })) : [];   // (LAST PORT: this camera's dead ports; set before every bake and draw)
        EXTRA = ownExtra;
        const isWide = shot !== 'close', cam = camera(AW, AH, RX && shot === 'mid' ? CAM_MID : isWide ? CAMS.wide : CAMS.close), N = AW * AH;
        const col = new Uint32Array(N), dep = new Float32Array(N).fill(Infinity);
        const mat = new Uint8Array(N), tone = new Float32Array(N), ndl = new Float32Array(N), rampOf = new Array(N);
        const wake = [], bayPx = [];                                         // [pixel, |angle| round the ring from the port]; [pixel, 0 floor | 1 frame]
        let row = 0, rowAt = 0, done = false, bakeMs = 0;                 // (rowAt: LAST PORT, where in its row a relay camera's bake is)
        const L = cam.L, near = Math.hypot(...[0, 1, 2].map(i => [0, -RM, RT][i] - cam.O[i])), farD = near + 2.2 * RM;
        const out = { r: null, v: 0, glow: false, wake: -1, bay: -1 };
        function pixel(x, y) {
            const i = y * AW + x, d = norm([0, 1, 2].map(k => cam.fw[k] * cam.F + cam.rt[k] * (x + 0.5 - cam.cx) - cam.up[k] * (y + 0.5 - cam.cy)));
            let ox = cam.O[0], oy = cam.O[1], oz = cam.O[2], tAll = 0;
            useWings = true;
            for (let pass = 0; pass < 3; pass++) {
                const t = marchRay(ox, oy, oz, d[0], d[1], d[2], cam.F);
                if (t < 0) { useWings = true; return; }
                const hx = ox + d[0] * t, hy = oy + d[1] * t, hz = oz + d[2] * t, part = partAt(hx, hy, hz);
                let look;
                if (part === M_WING) {
                    look = wingAt(hx, hy, hz, d, L);
                    if (!look) {                                             // a gap in the wing: on through it
                        const step = (WING.th * 2 + 0.3) / Math.max(0.15, Math.abs(d[2]));
                        ox = hx + d[0] * step; oy = hy + d[1] * step; oz = hz + d[2] * step; tAll += t + step; useWings = false;
                        continue;
                    }
                }
                const tt = tAll + t, e = Math.max(0.01, 0.6 * tt / cam.F), n = normalAt(hx, hy, hz, e);
                const nl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2], sh = nl > 0 ? shadowAt(hx + n[0] * e * 3, hy + n[1] * e * 3, hz + n[2] * e * 3, L) : 0, lit = nl > 0 ? nl * sh : 0;
                const hv = norm([L[0] - d[0], L[1] - d[1], L[2] - d[2]]), spec = sh * Math.pow(Math.max(0, n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]), SHADE.shine);
                const ao = occlusionAt(hx, hy, hz, n);
                if (look) { out.r = look[0]; out.v = look[1]; out.glow = look[2]; out.wake = -1; out.bay = -1; } else surface(part, hx, hy, hz, n, out);
                const far01 = clamp01((tt - near) / (farD - near));
                const v = out.glow ? out.v * (1 - 0.5 * SHADE.fade * far01) : (out.v * (SHADE.amb + (SHADE.gain - SHADE.amb) * Math.pow(lit, SHADE.pow)) * ao + (out.r === R.HULL ? SHADE.spec * spec : 0)) * (1 - SHADE.fade * far01);
                tone[i] = v; rampOf[i] = out.r; dep[i] = tt; mat[i] = out.glow ? 0 : part; ndl[i] = nl;
                if (out.wake >= 0) wake.push([i, out.wake]);
                if (out.bay >= 0) bayPx.push([i, out.bay]);
                useWings = true;
                return;
            }
            useWings = true;
        }
        /** The edges that face the light get a one-pixel rim; then every pixel takes its ramp step. */
        function finish() {
            for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
                const i = y * AW + x;
                if (!rampOf[i]) continue;
                if (mat[i] && ndl[i] > 0.28) {
                    const up = y > 0 ? i - AW : -1, lf = x > 0 ? i - 1 : -1;
                    const open = j => j < 0 || !rampOf[j] || dep[j] > dep[i] * 1.03 + 1;
                    if (open(up) || open(lf)) tone[i] = Math.max(tone[i], (mat[i] === M_WING || mat[i] === M_SPOKE ? 0.42 : 0.6) + 0.25 * Math.min(1, ndl[i]) - 0.2 * clamp01((dep[i] - near) / (farD - near)));
                }
                col[i] = rampOf[i].c32[level(rampOf[i], tone[i], x, y)];
            }
        }
        /** Our own class, dead, far behind the station: small, dim, rusted, broken; in the sky, so they wheel with it (the
            wide only: the close shot is all station and sky). One sprite per hull and angle step, kept. */
        const deadSprites = new Map();
        function deadSprite(k, angle) {
            const q = Math.round(angle / DEAD_STEP), key = k + ':' + q;
            let sp = deadSprites.get(key);
            if (sp) return sp;
            const [, , len, , from, to] = DEAD[k], half = Math.ceil(len * 0.62 + 4), p = P.painter(half * 2, half * 2, false);
            P.hull(p, { x: half, y: half, len, ht: len / 3.15, angle: q * DEAD_STEP, flip: true, light: k ? 0.5 : 0.62, rust: true, ramp: k ? RP.RUST : RP.HULL, seed: 40 + k, from, to, holes: k ? 0 : 0.72, fade: 0.3 }, P.shapeL);
            sp = { d32: new Uint32Array(p.data.buffer), w: half * 2, half };
            if (deadSprites.size > 90) deadSprites.delete(deadSprites.keys().next().value);
            deadSprites.set(key, sp);
            return sp;
        }
        function drawDead(buf, turn, ox, oy) {
            const c = Math.cos(turn), sn = Math.sin(turn), mx = AW / 2, my = AH / 2;
            DEAD.forEach(([fx, fy, , a], k) => {
                const dx = fx * AW - mx, dy = fy * AH - my, sp = deadSprite(k, a + turn);
                blitSprite(buf, sp, mx + dx * c - dy * sn + ox, my + dx * sn + dy * c + oy);
            });
        }
        function bake(ms) {
            if (done) return true;
            EXTRA = ownExtra;                                                // LAST PORT: this camera's station (the dead ports' collars, or none)
            const t0 = performance.now(), end = t0 + ms;
            while (row < AH) {
                if (RX) {                                                    // LAST PORT: a relay row costs more, so its slices may end mid-row
                    const stop = Math.min(AW, rowAt + RELAY_CHUNK);
                    for (let x = rowAt; x < stop; x++) pixel(x, row);
                    rowAt = stop;
                    if (rowAt >= AW) { rowAt = 0; row++; }
                } else {
                    for (let x = 0; x < AW; x++) pixel(x, row);
                    row++;
                }
                if (performance.now() > end) break;
            }
            if (row >= AH) { finish(); done = true; }
            bakeMs += performance.now() - t0;
            return done;
        }

        // ── the moving layer ──
        const lightPx = (buf, x, y, r, v) => {
            x = Math.round(x); y = Math.round(y);
            if (x < 0 || x >= AW || y < 0 || y >= AH) return;
            const i = y * AW + x, k = level(r, v, x, y);
            if (k && r.lum[k] > lum32(buf[i])) buf[i] = r.c32[k];
        };
        const putPx = (buf, x, y, r, v) => {
            x = Math.round(x); y = Math.round(y);
            if (x < 0 || x >= AW || y < 0 || y >= AH) return;
            const k = level(r, v, x, y); if (k) buf[y * AW + x] = r.c32[k];
        };
        /** Like putPx, but the ramp's darkest step (the ink) is painted too. */
        const inkPx = (buf, x, y, r, v) => {
            x = Math.round(x); y = Math.round(y);
            if (x >= 0 && x < AW && y >= 0 && y < AH) buf[y * AW + x] = r.c32[level(r, v, x, y)];
        };
        function glow(buf, cx, cy, rad, r, peak) {
            for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(AH - 1, Math.ceil(cy + rad)); y++) for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(AW - 1, Math.ceil(cx + rad)); x++) {
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad;
                if (d < 1) lightPx(buf, x, y, r, peak * (1 - d) ** 1.6);
            }
        }
        /** Is a point (its distance from the camera) in front of the station at art pixel (x, y)? */
        const seen = (x, y, dist) => { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= AW || y < 0 || y >= AH) return false; return dep[y * AW + x] > dist - 1.2; };
        // the light's direction in the picture (for the edges of what moves: the clamps, our hull, the pieces)
        const LS = (() => { const lx = L[0] * cam.rt[0] + L[1] * cam.rt[1] + L[2] * cam.rt[2], ly = -(L[0] * cam.up[0] + L[1] * cam.up[1] + L[2] * cam.up[2]), n = Math.hypot(lx, ly) || 1; return [lx / n, ly / n]; })();
        /** A bar of station steel from a to b (art px), lit along the edge that faces the light; once it is a few pixels
            thick, a seam across it every so often and a little grain (seed: which part). */
        function bar(buf, a, b, thick, dim, seed) {
            const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, half = thick / 2;
            const litSide = nx * LS[0] + ny * LS[1] > 0 ? 1 : -1, seam = thick >= 2.5 ? Math.max(4, thick * 1.7) : 0;
            const x0 = Math.floor(Math.min(a[0], b[0]) - thick), x1 = Math.ceil(Math.max(a[0], b[0]) + thick), y0 = Math.floor(Math.min(a[1], b[1]) - thick), y1 = Math.ceil(Math.max(a[1], b[1]) + thick);
            for (let y = Math.max(0, y0); y <= Math.min(AH - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(AW - 1, x1); x++) {
                const px = x + 0.5 - a[0], py = y + 0.5 - a[1], s = px * ux + py * uy, w = px * nx + py * ny;
                if (s < -0.3 || s > len + 0.3 || Math.abs(w) > half) continue;
                const edge = half - Math.abs(w) < 0.75;
                let v = edge ? (Math.sign(w) === litSide ? 0.82 : 0.12) : 0.4;
                if (seam && !edge && s > 1.5 && s < len - 1.5 && s % seam < 0.85) v = 0.2;
                if (thick >= 2) v += (hash(x, y, seed) - 0.5) * 0.12;
                buf[y * AW + x] = R.HULL.c32[level(R.HULL, v * dim, x, y)];
            }
        }
        /** A hinge: a round knuckle, lit on the side the light comes from, its pin in the middle. */
        function knuckle(buf, c, r) {
            if (r < 1) { putPx(buf, c[0], c[1], R.HULL, 0.62); return; }
            for (let y = Math.floor(c[1] - r - 1); y <= Math.ceil(c[1] + r + 1); y++) for (let x = Math.floor(c[0] - r - 1); x <= Math.ceil(c[0] + r + 1); x++) {
                const ex = x + 0.5 - c[0], ey = y + 0.5 - c[1], d = Math.hypot(ex, ey);
                if (d > r) continue;
                const lit = (ex * LS[0] + ey * LS[1]) / (d || 1);
                inkPx(buf, x, y, R.HULL, d < r * 0.4 ? 0.6 : d > r - 0.8 ? (lit > 0.2 ? 0.88 : 0.1) : 0.32 + 0.16 * lit);
            }
        }

        // our Lander: the game's hull, side on, at the angle and size the camera sees it (baked once per angle and size),
        // a rim of light along the edge that faces it
        const sprites = new Map();
        function lander(len, ht, deg, dead) {
            const key = len + '|' + ht + '|' + deg + (dead ? '|d' + dead : '');
            let sp = sprites.get(key);
            if (sp) return sp;
            const half = Math.ceil(len / 2 + ht + 3), W = half * 2, p = P.painter(W, W, false), a = deg * Math.PI / 180;
            const at = P.hull(p, { x: half, y: half, len, ht, angle: a, flip: true, seed: dead ? 50 + dead : 9, anchor: 0.5, light: dead ? 0.6 : 0.86, rust: !!dead, flat: len < 130, mirror: Math.cos(a) - Math.sin(a) < 0 }, P.shapeL);
            const rel = pt => [pt[0] - half, pt[1] - half], src = new Uint32Array(p.data.buffer), d32 = new Uint32Array(src);
            const sx = Math.round(LS[0] * 1.2), sy = Math.round(LS[1] * 1.2), rimLum = R.HULL.lum[R.HULL.n - 2];
            for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
                const i = y * W + x, X = x + sx, Y = y + sy;
                if (!(src[i] >>> 24) || lum32(src[i]) >= rimLum) continue;
                if (X < 0 || Y < 0 || X >= W || Y >= W || !(src[Y * W + X] >>> 24)) d32[i] = R.HULL.c32[level(R.HULL, dead ? 0.62 : 0.8, x, y)];
            }
            sp = { d32, w: W, half, ports: [0, 1, 2, 3, 4, 5].map(i => rel(at(P.DECK_U(i) + 0.054, -0.32))), deck: [0, 1, 2, 3, 4, 5].map(i => rel(at(P.DECK_U(i) + 0.05, -0.1))), lamp: rel(at(P.LANDER.NOSE + 0.06, -0.52)), bell: rel(at(1, 0)), skirt: rel(at(P.LANDER.BELL, 0)), nose: rel(at(0, 0)) };
            if (sprites.size > 60) sprites.delete(sprites.keys().next().value);
            sprites.set(key, sp);
            return sp;
        }
        function blitSprite(buf, sp, cx, cy) {
            const x0 = Math.round(cx) - sp.half, y0 = Math.round(cy) - sp.half;
            for (let y = 0; y < sp.w; y++) {
                const Y = y0 + y; if (Y < 0 || Y >= AH) continue;
                for (let x = 0; x < sp.w; x++) { const X = x0 + x, c = sp.d32[y * sp.w + x]; if (X >= 0 && X < AW && c >>> 24) buf[Y * AW + X] = c; }
            }
        }
        /** Our tail end, turned towards the camera: the skirt's rim (lit on the side the light comes from), dark under it,
            the bell's mouth in the middle, a little nearer us (warm while the drive burns). cosT: how much of the end the
            camera sees (0 side on). */
        function endCap(buf, sp, cx, cy, ax, ay, len, ht, cosT, burn) {
            const A = 0.55 * ht, Bm = Math.max(0.7, A * cosT), c0x = cx + sp.skirt[0], c0y = cy + sp.skirt[1], m = Math.ceil(A + 1), rimQ = (1 - Math.min(0.45, 1.3 / Bm)) ** 2;
            for (let yy = -m; yy <= m; yy++) for (let xx = -m; xx <= m; xx++) {
                const along = xx * ax + yy * ay, across = -xx * ay + yy * ax, q = (across / A) ** 2 + (along / Bm) ** 2;
                if (q > 1) continue;
                const X = c0x + xx, Y = c0y + yy, qb = (across / (A * 0.34)) ** 2 + ((along - 0.06 * len) / (Bm * 0.34)) ** 2;
                if (qb < 1) {
                    if (qb > 0.5) inkPx(buf, X, Y, R.HULL, 0.5);
                    else if (burn > 0.05) inkPx(buf, X, Y, R.PLUME, 0.45 + 0.45 * burn);
                    else inkPx(buf, X, Y, R.HULL, 0);
                    continue;
                }
                if (q > rimQ) { const lit = (xx * LS[0] + yy * LS[1]) / (Math.hypot(xx, yy) || 1); inkPx(buf, X, Y, R.HULL, lit > 0.1 ? 0.84 : 0.26); }
                else inkPx(buf, X, Y, R.HULL, 0.1 + 0.06 * (along / Bm));
            }
        }
        /** Our shadow on the station's steel: each pixel of steel near it is darkened where the light, on its way to it,
            passes through our hull (a capsule from nose to tail, the nose cone tapering). Only the pixels in the shadow's
            reach on screen are tried. */
        const SH = { floor: RT - 8, umbra: 0.1, soft: 0.45 };
        let shBox = [0, 0, 0, 0];
        function landerShadow(buf, A, B, ox, oy) {
            const D3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], c = dot3(D3, D3), bL = dot3(L, D3), R0 = LANDER.d / 2;
            const foot = p => add(p, L, -Math.max(0, (p[2] - SH.floor) / L[2]));
            const pts = [A, B, foot(B), foot(A)].map(p => cam.project(p));
            if (pts.some(p => !p)) return 0;
            const pad = R0 * cam.F / Math.min(pts[0][2], pts[1][2]) + 2;
            // the four points' hull on the screen, by angle round their middle
            const mx = pts.reduce((s, p) => s + p[0], 0) / 4, my = pts.reduce((s, p) => s + p[1], 0) / 4;
            const hull = pts.slice().sort((p, q) => Math.atan2(p[1] - my, p[0] - mx) - Math.atan2(q[1] - my, q[0] - mx));
            const ys = hull.map(p => p[1]), yLo = Math.min(...ys), yHi = Math.max(...ys);
            let n = 0; shBox = [AW, AH, 0, 0];
            for (let y = Math.max(0, Math.floor(yLo - pad)); y <= Math.min(AH - 1, Math.ceil(yHi + pad)); y++) {
                const yc = clamp(y + 0.5, yLo, yHi);
                let xa = Infinity, xb = -Infinity;
                for (let k = 0; k < 4; k++) {
                    const p = hull[k], q = hull[(k + 1) % 4];
                    if ((p[1] - yc) * (q[1] - yc) > 0 || p[1] === q[1]) { if (p[1] === yc) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); } continue; }
                    const x = p[0] + (yc - p[1]) * (q[0] - p[0]) / (q[1] - p[1]);
                    xa = Math.min(xa, x); xb = Math.max(xb, x);
                }
                if (xa > xb) continue;
                for (let x = Math.max(0, Math.floor(xa - pad)); x <= Math.min(AW - 1, Math.ceil(xb + pad)); x++) {
                    const j = y * AW + x, r = rampOf[j];
                    if (!r || !mat[j]) continue;                                   // sky, or a glowing part (the bay, windows)
                    const ex = x + 0.5 - cam.cx, ey = y + 0.5 - cam.cy;
                    let dx = cam.fw[0] * cam.F + cam.rt[0] * ex - cam.up[0] * ey, dy = cam.fw[1] * cam.F + cam.rt[1] * ex - cam.up[1] * ey, dz = cam.fw[2] * cam.F + cam.rt[2] * ex - cam.up[2] * ey;
                    const dn = dep[j] / Math.hypot(dx, dy, dz), px = cam.O[0] + dx * dn, py = cam.O[1] + dy * dn, pz = cam.O[2] + dz * dn;
                    const wx = px - A[0], wy = py - A[1], wz = pz - A[2], d = L[0] * wx + L[1] * wy + L[2] * wz, e = D3[0] * wx + D3[1] * wy + D3[2] * wz;
                    const den = c - bL * bL, sN = clamp01(den > 1e-6 ? (e - bL * d) / den : 0), t = sN * bL - d;
                    if (t < 0.3) continue;                                         // we are not between it and the light
                    const qx = px + L[0] * t - A[0] - D3[0] * sN, qy = py + L[1] * t - A[1] - D3[1] * sN, qz = pz + L[2] * t - A[2] - D3[2] * sN;
                    const dist = Math.sqrt(qx * qx + qy * qy + qz * qz), rad = R0 * 2 * Math.max(0.05, P.radiusL(sN));
                    if (dist > rad + SH.soft) continue;
                    const X = x + ox, Y = y + oy;
                    if (X < 0 || X >= AW || Y < 0 || Y >= AH) continue;
                    if (dist > rad && (dist - rad) / SH.soft > B8[((Y & 7) << 3) | (X & 7)]) continue;   // the soft edge, dithered
                    buf[Y * AW + X] = r.c32[level(r, tone[j] * SH.umbra, X, Y)];
                    n++; shBox[0] = Math.min(shBox[0], X); shBox[1] = Math.min(shBox[1], Y); shBox[2] = Math.max(shBox[2], X); shBox[3] = Math.max(shBox[3], Y);
                }
            }
            return n;
        }
        /** Home: the bay's floor goes dark and its lit frame becomes a thin warm seal round our nose (k 0..1). */
        function dimBay(buf, k, ox, oy) {
            for (let n = 0; n < bayPx.length; n++) {
                const i = bayPx[n][0], isFrame = bayPx[n][1] === 1, x = i % AW + ox, y = (i / AW | 0) + oy;
                if (x < 0 || x >= AW || y < 0 || y >= AH) continue;
                const r = isFrame && k > 0.5 ? R.WARM : R.AMBER, v = isFrame ? (k > 0.5 ? 0.78 : tone[i]) : tone[i] * (1 - 0.8 * k);
                buf[y * AW + x] = r.c32[level(r, v, x, y)];
            }
        }

        // the port's face, its up (off the face), along and across the ring; the four clamps' roots in the collar's top
        // corners; the port's own four lamps at the middle of the collar's edges (lit while we are lined up)
        const PF = [RM * PC, RM * PS, COL.top], TAN = [-PS, PC, 0], RAD = [PC, PS, 0], UP = [0, 0, 1];
        const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
        const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ a, b, at: add(add(PF, TAN, a * (COL.half - 0.55)), RAD, b * (COL.half - 0.55)) }));
        const FX = Math.max(1, cam.F / Math.hypot(PF[0] - cam.O[0], PF[1] - cam.O[1], PF[2] - cam.O[2]) / 2.1);   // how much nearer than a far shot
        const FXS = Math.min(2.6, FX ** 0.6), DOT = Math.max(1, Math.round(FX * 0.45)), SDOT = Math.max(1, Math.round(FX * 0.62));   // sizes grow slower than speeds; a dot's side; a spark's
        const LAMP_AT = (BAY.half + COL.half) / 2;
        const PORT_LAMPS = [[TAN, 1], [TAN, -1], [RAD, 1], [RAD, -1]].map(([v, sd]) => add(add(PF, v, sd * LAMP_AT), UP, 0.12));
        // the station's own lights round the ring's front: in twos and threes in the middle of a segment, none at the
        // joints, about a third of the segments dead, some bigger than others (du: how far round from the port; sd: which
        // way); and its three running lights (where the face's were: a quarter and a half turn from the port)
        const RING_LIGHTS = [], SEG_A = 2 * Math.PI / SEGS;
        for (let k = 1; k < SEGS; k++) {
            if (hash(k, 3, 91) < 0.3) continue;
            const n = hash(k, 5, 91) < 0.5 ? 2 : 3, mid = k * SEG_A + (hash(k, 7, 91) - 0.5) * SEG_A * 0.3;
            for (let j = 0; j < n; j++) {
                const w = wrapA(mid + (j - (n - 1) / 2) * 1.6 * Math.PI / 180), u = PU + w;
                RING_LIGHTS.push({ p: [Math.cos(u) * (RM - 3), Math.sin(u) * (RM - 3), RT - 0.4], du: Math.abs(w), sd: Math.sign(w) || 1, j: hash(k * 7 + j, 2, 91), big: hash(k, j, 13) < 0.35, b: 0.6 + 0.4 * hash(k, j, 17) });
            }
        }
        const RUNNING = [Math.PI / 2, -Math.PI / 2, Math.PI].map(du => { const u = PU + du; return [Math.cos(u) * RM, Math.sin(u) * RM, RT + 0.2]; });
        // the WARM ramp's step nearest a luminance (the bay's light washing our nose keeps its brightness)
        const WARM_AT = Uint8Array.from({ length: 256 }, (_, l) => R.WARM.lum.reduce((best, v, k) => (Math.abs(v - l) < Math.abs(R.WARM.lum[best] - l) ? k : best), 1));

        // ── the shot. Until the touch the Lander is where the flight's own track had it (replayed: metres above the port,
        //    how far off it, how unmatched the roll, the drive, the nose thrusters). From the touch, the grade's beats, in
        //    seconds after it: soft, a little give and the clamps draw it in; rough, it knocks the rim and scrapes into
        //    place, the fourth clamp catching late; hard, it strikes, bounces off and comes back ──
        const BROKE = { crash: 0.32, rough: 0.16 };                         // how far round from the port (rad) a hard or rough touch breaks the lights
        const LAT_M = 2.0, TILT = 0.14;                                      // a full lat (the game's rough limit) in metres across the port; a full tilt (rad)
        function beats(grade) {
            const b = BEATS[grade] || BEATS.soft, events = [[0, 'touch']];
            if (b.late) events.push([b.late, 'late']);
            if (b.back) events.push([b.back, 'second']);
            events.push([b.lock, 'lock'], [b.lights, 'lights']);
            return RX ? { lock: b.lock, lights: b.lights, events, relay: relayBeats(grade) } : { lock: b.lock, lights: b.lights, events };
        }
        /** The Lander now (since: seconds after the touch, < 0 before it): s (metres above the port's face), lat (metres
            across it), tilt (rad), drive (its burn), brake (the nose thrusters), rattle. */
        function pose(f, since) {
            const lat0 = clamp(f.lat || 0, -1, 1) * LAT_M, tilt0 = clamp(f.tilt || 0, -1, 1) * TILT, sd = Math.sign(lat0) || 1;
            if (since < 0) return { s: Math.max(0, f.s || 0), lat: lat0, tilt: tilt0, drive: 0.12 + 0.6 * clamp01(f.drive || 0), brake: !!f.brake, rattle: 0 };
            const b = BEATS[f.grade] || BEATS.soft;
            if (f.grade === 'rough') {
                const k = clamp01(since / b.seat), wob = Math.exp(-since * 3.2) * Math.sin(since * 26);
                return { s: 0.35 * (1 - k), lat: lat0 * (1 - ease(k)), tilt: tilt0 * (1 - k) + sd * 0.25 * wob, drive: 0, brake: false, rattle: Math.exp(-since * 4) };
            }
            if (f.grade === 'crash') {
                const up = clamp01(since / b.peak), down = clamp01((since - b.peak) / (b.back - b.peak)), arc = Math.sin(Math.PI * clamp01(since / b.back));
                const s = since < b.peak ? b.bounce * Math.sin(Math.PI / 2 * up) : since < b.back ? b.bounce * (1 - ease(down)) : -0.2 * Math.sin(Math.PI * clamp01((since - b.back) / 0.35));
                const tilt = since < b.back ? sd * 0.34 * arc * (1 + 0.25 * Math.sin(since * 9)) : 0;
                const lat = since < b.back ? lat0 * (1 - ease(since / b.back)) + sd * 3.4 * arc : 0;
                return { s, lat, tilt, drive: since > b.peak - 0.25 && since < b.back - 0.3 ? 0.95 : 0, brake: since > b.back - 0.9 && since < b.back - 0.1, rattle: Math.exp(-since * 3) };
            }
            const k = ease(since / b.pull);
            return { s: -0.3 * Math.sin(Math.PI * clamp01(since / 0.35)), lat: lat0 * (1 - k), tilt: tilt0 * (1 - k), drive: 0.1 * Math.max(0, 1 - since / 0.6), brake: false, rattle: 0 };
        }
        /** How shut clamp j is (0 standing open .. 1 on our hull), and whether its lamp is on. */
        function clampState(f, since, j) {
            if (since < 0) return [0, false];
            const b = BEATS[f.grade] || BEATS.soft, lag = j * 0.05;
            if (f.grade === 'rough' && j === 3) return [easeOut((since - b.late) / 0.12), since > b.late + 0.12];
            if (f.grade === 'crash' && since < b.clamp) return [0.45 * Math.sin(Math.PI * clamp01(since / 0.6)), false];   // they reach for it, and miss
            return [easeOut((since - b.clamp - lag) / b.clampT), since > b.lock + lag];
        }

        // ── the strike, worked out once per cut: sparks fanned off the port's face and along its rim (to the side we
        //    knocked), pieces, and the panel off our broken deck ──
        let burst = null, lastFrame = {};
        const rnd = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        /** The picture's own directions at the port, as unit vectors: off the face (+z), along the ring, across it. */
        const AX = (() => {
            const o = cam.project(PF), dir = v => { const p = cam.project(add(PF, v, 4)), dx = p[0] - o[0], dy = p[1] - o[1], n = Math.hypot(dx, dy) || 1; return [dx / n, dy / n]; };
            return { up: dir(UP), along: dir(TAN), across: dir(RAD) };
        })();
        function makeBurst(grade, side) {
            const r = rnd(grade === 'crash' ? 77 : 33), isCrash = grade === 'crash';
            const fan = () => {
                const k = isCrash ? [0.3 + 0.7 * r(), (r() - 0.5) * 2.6, (r() - 0.5) * 1.6] : [0.2 + 0.6 * r(), side * (0.5 + r()), (r() - 0.5) * 0.8];
                const dx = AX.up[0] * k[0] + AX.along[0] * k[1] + AX.across[0] * k[2], dy = AX.up[1] * k[0] + AX.along[1] * k[1] + AX.across[1] * k[2], n = Math.hypot(dx, dy) || 1;
                return { dx: dx / n, dy: dy / n };
            };
            const n = isCrash ? 64 : grade === 'rough' ? 72 : 0;
            const sparks = Array.from({ length: n }, (_, i) => ({ ...fan(), sp: (isCrash ? 70 : 50) + r() * (isCrash ? 180 : 110), life: 0.25 + r() * (isCrash ? 0.95 : 0.6), at: isCrash ? r() * 0.08 : i < 40 ? r() * 0.06 : 0.18 + r() * 0.42 }));
            const bits = isCrash ? Array.from({ length: 9 }, () => ({ ...fan(), sp: 20 + r() * 40, coast: 1.5 + r() * 4, spin: (r() - 0.5) * 5, w: 1 + Math.round(r() * 2) })) : [];
            return { grade, side, sparks, bits, panel: null, puff: Array.from({ length: 10 }, () => ({ ...fan(), sp: 6 + r() * 10 })) };
        }
        /** The baked steel round (cx, cy) relit a little brighter (the station's own lights pooling on it): only the surface
            at about `dist` from the camera, so a light on the near ring never lights the far one. */
        function pool(buf, cx, cy, dist, rad, k, ox, oy) {
            for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(AH - 1, Math.ceil(cy + rad)); y++) for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(AW - 1, Math.ceil(cx + rad)); x++) {
                const sx = x - ox, sy = y - oy;
                if (sx < 0 || sx >= AW || sy < 0 || sy >= AH) continue;
                const j = sy * AW + sx, r = rampOf[j], d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad;
                if (!r || !mat[j] || d >= 1 || Math.abs(dep[j] - dist) > 10) continue;
                const lv = level(r, tone[j] + k * (1 - d) * (1 - d), sx, sy), i = y * AW + x;
                if (r.lum[lv] > lum32(buf[i])) buf[i] = r.c32[lv];
            }
        }
        /** A dot of n x n art pixels (one in the wide shot), drawn over whatever is there. */
        function dotPx(buf, x, y, r, v, n) { for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) putPx(buf, x + i, y + j, r, v); }
        /** A spark: a hot head and its tail, overwriting what is under it (it must show on lit steel too). */
        function spark(buf, x, y, dx, dy, heat) {
            dotPx(buf, x, y, heat > 0.55 ? R.SUN : R.AMBER, heat > 0.55 ? 0.7 + 0.3 * heat : 0.55 + 0.4 * heat, SDOT);
            const tail = Math.round(4 * FXS);
            for (let k = 1; k <= tail; k++) lightPx(buf, x - dx * k * 1.3, y - dy * k * 1.3, R.SUN, (0.75 - k / tail * 0.6) * heat + 0.1);
        }
        /** A lamp: a cold point with its small dithered halo. */
        function lamp(buf, x, y, k, big) {
            glow(buf, x, y, (big ? 5 : 3.4) * FXS, R.COLD, (big ? 0.9 : 0.8) * k);
            const n = big ? DOT + 1 : DOT;
            for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) putPx(buf, x + i, y + j, R.COLD, i || j ? 0.85 * k : k);
        }
        /** A slow vent: thin wisps of air (ice) leaving (x, y) along (dx, dy), reach art px, and thinning out. */
        function vent(buf, x, y, dx, dy, t, reach, dim) {
            for (let q = 0; q < 16; q++) {
                const age = (t * 0.42 + q / 16) % 1, wob = Math.sin(q * 2.3 + t * 1.7) * 0.35, v = dim * (1 - age) ** 1.4;
                const px = x + (dx - dy * wob * 0.6) * age * reach, py = y + (dy + dx * wob * 0.6) * age * reach;
                glow(buf, px, py, Math.max(1.2, 1.8 * FXS * (0.6 + age)), R.ICE, 0.55 * v);
                if (v > 0.45) dotPx(buf, px, py, R.ICE, 0.65 + 0.35 * v, DOT); else lightPx(buf, px, py, R.ICE, 1.1 * v);
            }
        }
        /** The bay's light on our hull near the port: the sprite's own pixels, a dithered share of them turned to the warm
            ramp at the same brightness (warmth on the nose that is about to go in). */
        function warmWash(buf, sp, cx, cy, bx, by, rad, k) {
            if (k <= 0.02) return;
            const x0 = Math.round(cx) - sp.half, y0 = Math.round(cy) - sp.half;
            for (let y = 0; y < sp.w; y++) {
                const Y = y0 + y; if (Y < 0 || Y >= AH) continue;
                for (let x = 0; x < sp.w; x++) {
                    const X = x0 + x; if (X < 0 || X >= AW || !(sp.d32[y * sp.w + x] >>> 24)) continue;
                    const d = Math.hypot(X + 0.5 - bx, Y + 0.5 - by) / rad;
                    if (d >= 1 || k * (1 - d) ** 1.6 <= B8[((Y & 7) << 3) | (X & 7)]) continue;
                    const i = Y * AW + X; buf[i] = R.WARM.c32[WARM_AT[Math.min(255, lum32(buf[i]) + 14)]];
                }
            }
        }
        /** A clamp at its true size: an arm of station steel from its hinge in the collar's corner up to the knee (a second
            hinge) and on to the jaw, a short pad across the arm's end that closes on our hull. */
        function clampArm(buf, m, th, j) {
            bar(buf, m.root, m.knee, th, 0.95, 11 + j); bar(buf, m.knee, m.tip, th * 0.85, 1, 21 + j);
            knuckle(buf, m.root, th * 0.72); knuckle(buf, m.knee, th * 0.62);
            const dx = m.tip[0] - m.knee[0], dy = m.tip[1] - m.knee[1], n = Math.hypot(dx, dy) || 1, jx = -dy / n * th * 0.7, jy = dx / n * th * 0.7;
            bar(buf, [m.tip[0] - jx, m.tip[1] - jy], [m.tip[0] + jx, m.tip[1] + jy], Math.max(1.2, th * 0.6), 1.05, 31 + j);
        }
        /** The clamps of one side (behind our hull or in front of it), then their lamps, so no arm hides another's. */
        function clampSide(buf, list, th) {
            list.forEach(m => clampArm(buf, m, th, m.j));
            list.forEach(m => { if (m.isLocked) { glow(buf, m.tip[0], m.tip[1], 2.2 * FXS, R.COLD, 0.6); dotPx(buf, m.tip[0], m.tip[1], R.COLD, 0.95, DOT); } });
        }
        /** Where a rough touch knocked the collar (metres along the ring from the port's middle). */
        const knockAt = (f, side) => side * clamp(Math.abs(clamp(f.lat || 0, -1, 1) * LAT_M) + LANDER.d / 2, BAY.half + 0.3, COL.half - 0.35);
        /** What a strike leaves on the collar: a rough one, a gouge along its top from where we knocked it to where we came
            to rest, bare metal (bright, hot at first) with scorched edges; a hard one, a scorch where our nose hit. */
        function scars(buf, grade, since, f, side, shift) {
            const lat0 = clamp(f.lat || 0, -1, 1) * LAT_M, w = Math.max(1, Math.round(FX * 0.65));
            if (grade === 'rough') {
                const at = knockAt(f, side), n = Math.ceil(40 * FXS), upTo = clamp01(since / 0.65), ox = Math.round(f.ox || 0), oy = Math.round(f.oy || 0);
                const pts = [];
                for (let k = 0; k <= n * upTo; k++) {
                    const t = k / n, p = shift(cam.project(add(add(PF, TAN, at - side * (0.35 * t + 0.08 * Math.sin(t * 9))), RAD, 1.1 - 2.9 * t)));   // along the rim, where our skirt dragged
                    if (p && seen(p[0] - ox, p[1] - oy, p[2])) pts.push([p[0], p[1], t, k, clamp01(1 - (since - 0.65 * t) / 1.4)]);
                }
                const half = Math.max(1, Math.round(w * 0.9));
                pts.forEach(([x, y, , k, hot]) => {                                                                    // the scorch either side
                    for (let a = -half; a <= half; a++) for (let c = -half; c <= half; c++) if (Math.max(Math.abs(a), Math.abs(c)) < half || hash(k + a, c, 9) < 0.7) inkPx(buf, x + a, y + c, hot > 0.5 ? R.AMBER : R.RUST, hot > 0.5 ? 0.35 : 0.08 + 0.08 * hash(k, a + c, 3));
                });
                pts.forEach(([x, y, t, , hot]) => inkPx(buf, x, y, hot > 0.2 ? R.AMBER : R.HULL, hot > 0.2 ? 0.55 + 0.45 * hot : 0.82 - 0.2 * t));   // bare metal down the middle (hot at first)
                return;
            }
            const c = cam.project(add(PF, TAN, lat0));
            if (!c) return;
            const p0 = shift(c), rr = 1.3 * cam.F / c[2];
            for (let y = Math.floor(p0[1] - rr); y <= Math.ceil(p0[1] + rr); y++) for (let x = Math.floor(p0[0] - rr); x <= Math.ceil(p0[0] + rr); x++) {
                const ex = x + 0.5 - p0[0], ey = (y + 0.5 - p0[1]) * 1.6, d = Math.hypot(ex, ey) / rr, a = Math.atan2(ey, ex);
                if (d > 0.35 + 0.65 * hash(Math.floor((a + 4) * 4), 1, 9) || x < 0 || x >= AW || y < 0 || y >= AH) continue;
                const sx = x - Math.round(f.ox || 0), sy = y - Math.round(f.oy || 0);
                if (sx < 0 || sx >= AW || sy < 0 || sy >= AH || !rampOf[sy * AW + sx] || Math.abs(dep[sy * AW + sx] - c[2]) > 4) continue;
                inkPx(buf, x, y, R.RUST, 0.12 + 0.2 * d);
            }
        }

        // ══ LAST PORT (relay): three of our class in the ring's other ports, nose in as we are, dark; their windows light in
        //    turn once our clamps hold; a hard dock tears one loose and it falls towards the moon; the screen says SENT ══
        const DP = RX ? RX.ports.map((d, k) => { const u = PU + d, c = Math.cos(u), s = Math.sin(u); return { k, d, PF: [RM * c, RM * s, COL.top], TAN: [-s, c, 0], RAD: [c, s, 0] }; }) : [];
        // a dead hull sags a little in its clamps; the decks its windows light (the decks ours has lit); a torn one: when it
        // breaks after the touch (s), how long it falls (s), how far (m), how it pops off (m up and out) and turns over (rad/s)
        // (each deck a beat after the one above it, so they come on deck by deck, as ours are lit); a window's glow (art px),
        // ours the same in the relay
        const DEADH = { sag: 0.03, lit: [0, 2, 3, 4], step: 0.18, flick: 0.12 }, TORN = { at: 0.12, T: 9, far: 2600, lift: 7, out: 9, turn: 0.55, ease: 2.4, drift: 5.5, driftT: 3.5 };   // (up and out past the ring's edge, so it falls in front of it)
        const winGlow = Math.max(3.2, 2.6 * FXS);
        const relayInfo = { lit: 0, sent: false, torn: null };
        const tornSparks = (() => { const r = rnd(91); return Array.from({ length: 26 }, () => ({ a: r() * 6.283, sp: 30 + r() * 90, life: 0.25 + r() * 0.6, at: r() * 0.15 })); })();
        const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        /** Which way a picture point lies from the camera (unshifted art px). */
        const rayOf = (x, y) => norm([0, 1, 2].map(k => cam.fw[k] * cam.F + cam.rt[k] * (x + 0.5 - cam.cx) - cam.up[k] * (y + 0.5 - cam.cy)));
        /** Where a torn hull falls to: a point on the moon's disc inside the picture (f.relay.moon, in the picture's own px),
            one the station does not cover (it ends a speck over the moon, not behind the ring), as near the middle as can be. */
        function fallTarget(f, ox, oy) {
            const m = f.relay && f.relay.moon;
            if (!m) return add(cam.O, rayOf(AW * 0.86, AH * 0.9), TORN.far);
            const mx = m[0] - ox, my = m[1] - oy, r = m[2], dx = AW / 2 - mx, dy = AH / 2 - my, dl = Math.hypot(dx, dy) || 1, pad = 22;
            let open = null, od = Infinity;
            const isSky = (x, y) => x < 0 || x >= AW || y < 0 || y >= AH || dep[y * AW + x] === Infinity;      // (and clear of the station by a margin)
            for (let gy = -0.9; gy <= 0.9; gy += 0.1) for (let gx = -0.9; gx <= 0.9; gx += 0.1) {
                const qx = Math.round(mx + gx * r), qy = Math.round(my + gy * r);
                if (gx * gx + gy * gy > 0.72 || qx < pad || qx >= AW - pad || qy < pad || qy >= AH - pad || ![[0, 0], [16, 0], [-16, 0], [0, 16], [0, -16]].every(([a, b]) => isSky(qx + a, qy + b))) continue;
                const d = Math.hypot(qx - AW / 2, qy - AH / 2);
                if (d < od) { od = d; open = [qx, qy]; }
            }
            if (open) return add(cam.O, rayOf(open[0], open[1]), TORN.far);
            let px = mx + dx / dl * Math.min(dl, r * 0.82), py = my + dy / dl * Math.min(dl, r * 0.82);
            for (let a = 0; a <= 1; a += 0.01) { const qx = mx + dx * a, qy = my + dy * a; if (qx > pad && qx < AW - pad && qy > pad && qy < AH - pad) { if (Math.hypot(qx - mx, qy - my) < r * 0.9) { px = qx; py = qy; } break; } }
            return add(cam.O, rayOf(px, py), TORN.far);
        }
        /** The dead hulls now: nose and tail (m), how far from the camera, whether it casts a shadow, which it is, torn. */
        function deadPoses(f, since, grade, side) {
            const tornK = grade === 'crash' ? RX.torn(side) : -1;
            return DP.map(p => {
                const sag = RX.sag ? RX.sag[p.k] : DEADH.sag * (p.k % 2 ? 1 : -1), axis0 = norm(add(UP, p.TAN, sag)), seat = add(p.PF, UP, -LANDER.seat);   // (crooked in its clamps, as the glass shows it)
                let nose3 = seat, axis = axis0, tt = -1;
                if (p.k === tornK && since > TORN.at) {
                    tt = since - TORN.at;
                    const s = Math.min(1, tt / TORN.T) ** TORN.ease, base = add(add(seat, UP, TORN.lift * (1 - Math.exp(-tt * 1.4))), p.RAD, TORN.out * (1 - Math.exp(-tt)));
                    const T = fallTarget(f, Math.round(f.ox || 0), Math.round(f.oy || 0));
                    // across the picture first (the part of the way to the moon that is not away from the camera), then away
                    const v = sub3(T, base), rb = norm(sub3(base, cam.O)), along = dot3(v, rb), lat = norm(sub3(v, [rb[0] * along, rb[1] * along, rb[2] * along]));
                    const drift = TORN.drift * Math.min(tt, TORN.driftT) + TORN.drift * 0.4 * Math.max(0, tt - TORN.driftT);
                    nose3 = [0, 1, 2].map(i => base[i] + lat[i] * drift + (T[i] - base[i]) * s);
                    const th = TORN.turn * tt; axis = norm([0, 1, 2].map(i => axis0[i] * Math.cos(th) + p.RAD[i] * Math.sin(th)));
                }
                const tail3 = add(nose3, axis, LANDER.len), mid3 = add(nose3, axis, LANDER.len / 2), d = [0, 1, 2].map(i => mid3[i] - cam.O[i]);
                return { p, nose3, tail3, mid3, dist: Math.hypot(...d), shadow: tt < 0.6, tt, torn: p.k === tornK };
            });
        }
        /** A sprite drawn only where the station is not nearer the camera (a hull falling away behind the ring). */
        function blitSpriteZ(buf, sp, cx, cy, dist, ox, oy) {
            const x0 = Math.round(cx) - sp.half, y0 = Math.round(cy) - sp.half;
            for (let y = 0; y < sp.w; y++) {
                const Y = y0 + y, sy = Y - oy; if (Y < 0 || Y >= AH) continue;
                for (let x = 0; x < sp.w; x++) {
                    const X = x0 + x, c = sp.d32[y * sp.w + x], sx = X - ox;
                    if (X < 0 || X >= AW || !(c >>> 24)) continue;
                    if (sx >= 0 && sx < AW && sy >= 0 && sy < AH && dep[sy * AW + sx] < dist - 3) continue;
                    buf[Y * AW + X] = c;
                }
            }
        }
        /** One dead hull: its clamps (shut; a torn one's hang open), the game's Lander sprite dark and rusted, its tail end,
            its windows (dark; lit in turn from wins[k], the decks ours has lit, each flickering on), its clamps' lamps with
            them; a torn one's sparks where it broke. */
        function drawDeadHull(buf, d, f, since, grade, th, ox, oy, shift) {
            const { p } = d, pn = shift(cam.project(d.nose3)), pt = shift(cam.project(d.tail3)), pm = shift(cam.project(d.mid3));
            if (!pn || !pt || !pm) return;
            const rb = grade ? relayBeats(grade) : null, winAt = rb ? rb.wins[p.k] : Infinity;
            const lenRaw = Math.hypot(pn[0] - pt[0], pn[1] - pt[1]), isOpen = d.torn && d.tt > 0;
            const isLitAt = j => !d.torn && since >= winAt + j * DEADH.step && (since - winAt - j * DEADH.step > DEADH.flick || Math.floor((since - winAt) * 30) % 2 === 0);   // (a torn one stays dark)
            // its clamps: shut on its hull, or (torn) hanging open where they let go
            const toC0 = c => norm([c[0] - p.PF[0], c[1] - p.PF[1], 0]), hullAx = norm(sub3(d.tail3, d.nose3));
            const arms = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b], j) => {
                const root = add(add(p.PF, p.TAN, a * (COL.half - 0.55)), p.RAD, b * (COL.half - 0.55)), toC = toC0(root), k = isOpen ? 0.3 : 1;
                const kneeOpen = add(add(root, toC, 0.7), UP, 1.6), tipOpen = add(add(root, toC, 1.5), UP, 2.5);
                const grip = isOpen ? add(p.PF, UP, 2.4 - LANDER.seat) : add(d.nose3, hullAx, 2.4), kneeShut = add(add(root, toC, 0.2), UP, 1.4), tipShut = add(grip, toC, LANDER.d / 2 + 0.12);
                const knee = [0, 1, 2].map(i => lerp(kneeOpen[i], kneeShut[i], k)), tip = [0, 1, 2].map(i => lerp(tipOpen[i], tipShut[i], k));
                const r2 = shift(cam.project(root)), k2 = shift(cam.project(knee)), t2 = shift(cam.project(tip));
                return r2 && k2 && t2 ? { root: r2, knee: k2, tip: t2, isLocked: !isOpen && isLitAt(0), behind: t2[2] > (d.torn ? Infinity : pm[2]), j } : null;
            }).filter(Boolean);
            clampSide(buf, arms.filter(m => m.behind), th);
            if (lenRaw >= 6) {
                const len = Math.max(8, Math.round(lenRaw)), ht = Math.max(4, Math.round(LANDER.d * cam.F / pm[2] * 2) / 2);
                const deg = Math.round(Math.atan2(pn[1] - pt[1], pn[0] - pt[0]) * 180 / Math.PI), sp = lander(len, ht, deg, p.k + 1), cx = pm[0], cy = pm[1];
                if (d.torn && d.tt > 0) blitSpriteZ(buf, sp, cx, cy, d.dist, ox, oy); else blitSprite(buf, sp, cx, cy);
                const ratio = clamp01(lenRaw / (LANDER.len * cam.F / pm[2])), cosT = Math.sqrt(1 - ratio * ratio), ax = (pt[0] - pn[0]) / (lenRaw || 1), ay = (pt[1] - pn[1]) / (lenRaw || 1);
                if (pt[2] < pn[2] && cosT > 0.15 && !(d.torn && d.tt > 0)) endCap(buf, sp, cx, cy, ax, ay, len, ht, cosT, 0);
                DEADH.lit.forEach((j, o) => {
                    if (!isLitAt(o)) return;
                    const q = sp.ports[j], x = cx + q[0], y = cy + q[1];
                    glow(buf, x, y, winGlow, R.WARM, 0.62);
                    dotPx(buf, x, y, R.AMBER, 0.95, Math.max(2, DOT));
                    relayInfo.lit++;
                });
            } else if (lenRaw >= 1.5) {                                                  // far off: a sliver, still lit by the station's light
                const n = Math.ceil(lenRaw);
                for (let q = 0; q <= n; q++) lightPx(buf, pn[0] + (pt[0] - pn[0]) * q / n, pn[1] + (pt[1] - pn[1]) * q / n, R.HULL, 0.55);
                if (isLitAt(0)) lightPx(buf, pm[0], pm[1], R.AMBER, 0.85);
            }
            clampSide(buf, arms.filter(m => !m.behind), th);
            if (d.torn && d.tt >= 0 && d.tt < 0.9) {                                   // where it broke from its clamps
                const o = shift(cam.project(p.PF));
                if (o) {
                    if (d.tt < 0.2) glow(buf, o[0], o[1], 12 * FXS, R.SUN, 1.1 * (1 - d.tt / 0.2));
                    tornSparks.forEach(sk => { const age = d.tt - sk.at; if (age < 0 || age > sk.life) return; const dx = Math.cos(sk.a), dy = Math.sin(sk.a) * 0.7 - 0.3; spark(buf, o[0] + dx * sk.sp * FX * age, o[1] + dy * sk.sp * FX * age, dx, dy, 1 - age / sk.life); });
                }
            }
            if (d.torn) relayInfo.torn = { tt: +d.tt.toFixed(2), x: Math.round(pm[0]), y: Math.round(pm[1]), len: Math.round(lenRaw), dist: Math.round(d.dist) };
        }
        // the screen: a small panel set into the ring's front face beside our collar (the side the cameras are on, between
        // us and 17,199). Recessed: a lip round it, dark on the side the light comes from and lit on the far side (a hollow
        // in the steel, not a plate laid on it). Dark glass, faintly grained, from the first frame of the cut; at the beat
        // SENT in the game's own 3 x 5 letters, dim ice blue (COLD's third step, its top step only as a blink comes on), the
        // glass round them barely lit, a faint glow: three slow blinks, then held. The glass and its lip are in perspective;
        // the letters are whole art pixels (cells of `cell` px, as big as the glass holds), upright, riding the panel's own
        // slope, as a small screen's pixels read from across a dock. Half its width and height (m), how far along the ring
        // from the port's middle, the lip (m); the blinks (s on, s off), the glow
        const SCR = { w: 2.1, h: 1.1, along: -(COL.half + 3.1), lip: 0.17, blinks: 3, on: 0.8, off: 0.5, glow: 0.15 };
        const SCR_C = add([PC * RM, PS * RM, RT + 0.06], TAN, SCR.along), SCR_N = UP, SCR_U = TAN, SCR_V = [-RAD[0], -RAD[1], 0];
        const SENT_CELLS = (() => { const str = RX ? RX.sent : 'SENT', list = []; P.pixelText(str, 0, 0, (x, y) => list.push([x, y])); return { list, w: P.pixelTextWidth(str), h: 5 }; })();
        const SCR_LU = LIGHT[0] * SCR_U[0] + LIGHT[1] * SCR_U[1], SCR_LV = LIGHT[0] * SCR_V[0] + LIGHT[1] * SCR_V[1];   // where the light comes from, along the panel
        const glassAt = RX ? new Uint8Array(AW * AH) : null, glassList = [];                 // the glass's pixels this frame (the letters stay on it)
        /** How lit the words are k s after the beat (0 dark .. 1 a blink coming on): three slow blinks, the last one held. */
        function sentLevel(k) {
            if (k < 0) return 0;
            const per = SCR.on + SCR.off, n = Math.floor(k / per), ph = k - n * per, peak = q => 0.8 + 0.2 * Math.max(0, 1 - q / 0.3);
            if (n >= SCR.blinks - 1) return peak(k - (SCR.blinks - 1) * per);
            return ph < SCR.on ? peak(ph) : 0;
        }
        function sentScreen(buf, since, grade, ox, oy) {
            const rb = grade ? relayBeats(grade) : null, lv = rb ? sentLevel(since - rb.sent) : 0;
            relayInfo.sent = lv > 0;
            if (dot3(sub3(cam.O, SCR_C), SCR_N) <= 0) return;
            const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => cam.project(add(add(SCR_C, SCR_U, a * SCR.w), SCR_V, b * SCR.h)));
            if (corners.some(c => !c)) return;
            const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]), inW = SCR.w - SCR.lip, inH = SCR.h - SCR.lip;
            for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(AH - 1, Math.ceil(Math.max(...ys))); y++) for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(AW - 1, Math.ceil(Math.max(...xs))); x++) {
                const dr = rayOf(x, y), den = dot3(dr, SCR_N);
                if (Math.abs(den) < 1e-4) continue;
                const t = dot3(sub3(SCR_C, cam.O), SCR_N) / den;
                if (t <= 0 || Math.abs(dep[y * AW + x] - t) > 1.2) continue;               // the ring's face is what is there
                const pt3 = add(cam.O, dr, t), rel = sub3(pt3, SCR_C), u = dot3(rel, SCR_U), w = dot3(rel, SCR_V);
                if (Math.abs(u) > SCR.w || Math.abs(w) > SCR.h) continue;
                const X = x + ox, Y = y + oy;
                if (X < 0 || X >= AW || Y < 0 || Y >= AH) continue;
                if (Math.abs(u) > inW || Math.abs(w) > inH) {                               // the lip: the wall facing the light lit, the other dark
                    const du = Math.abs(u) > inW ? -Math.sign(u) * SCR_LU : 0, dv = Math.abs(w) > inH ? -Math.sign(w) * SCR_LV : 0;
                    buf[Y * AW + X] = R.HULL.c32[level(R.HULL, du + dv > 0 ? 0.55 : 0.07, X, Y)];
                    continue;
                }
                const i = Y * AW + X;
                buf[i] = R.COLD.c32[level(R.COLD, lv > 0 ? 0.1 + 0.1 * lv : 0.06 + 0.06 * hash(X, Y, 23), X, Y)];
                glassAt[i] = 1; glassList.push(i);
            }
            if (lv > 0) {                                                                    // the word: whole pixels, upright, along the panel's slope
                const c0 = cam.project(SCR_C), pa = cam.project(add(SCR_C, SCR_U, -inW)), pb = cam.project(add(SCR_C, SCR_U, inW));
                const span = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), cell = clamp(Math.floor(span / (SENT_CELLS.w + 2)), 1, 3), slope = (pb[1] - pa[1]) / ((pb[0] - pa[0]) || 1);
                const x0 = Math.round(c0[0] + ox - SENT_CELLS.w * cell / 2), y0 = Math.round(c0[1] + oy - SENT_CELLS.h * cell / 2), v = 0.55 + 0.25 * lv;
                SENT_CELLS.list.forEach(([gx, gy]) => {
                    const bx = x0 + gx * cell, by = y0 + gy * cell + Math.round((bx + cell / 2 - c0[0] - ox) * slope);
                    for (let j = 0; j < cell; j++) for (let k = 0; k < cell; k++) {
                        const X = bx + k, Y = by + j, i = Y * AW + X;
                        if (X >= 0 && X < AW && Y >= 0 && Y < AH && glassAt[i]) buf[i] = R.COLD.c32[level(R.COLD, v, X, Y)];
                    }
                });
                glow(buf, c0[0] + ox, c0[1] + oy, SCR.w * 1.6 * cam.F / c0[2], R.COLD, SCR.glow * lv);
            }
            for (let n = 0; n < glassList.length; n++) glassAt[glassList[n]] = 0;
            glassList.length = 0;
        }

        /** One frame of the shot. */
        function draw(buf, f) {
            const te = f.te || 0, since = f.touch >= 0 ? te - f.touch : -1, grade = since >= 0 ? f.grade || 'soft' : null, b = BEATS[grade] || BEATS.soft;
            const ox = Math.round(f.ox || 0), oy = Math.round(f.oy || 0), side = Math.sign(f.lat || 1);
            if (grade && (!burst || burst.grade !== grade)) burst = makeBurst(grade, side);
            if (isWide && !RX) drawDead(buf, f.turn || 0, ox, oy);         // far behind, wheeling with the sky (LAST PORT: not there)
            for (let y = 0; y < AH; y++) {                                     // the station
                const sy = y - oy; if (sy < 0 || sy >= AH) continue;
                const row = y * AW, srow = sy * AW;
                for (let x = 0; x < AW; x++) { const sx = x - ox; if (sx < 0 || sx >= AW) continue; const c = col[srow + sx]; if (c) buf[row + x] = c; }
            }
            const shift = p => (p ? [p[0] + ox, p[1] + oy, p[2]] : null);
            const tick = Math.floor(te * 8), wave = grade && !RX ? since - b.lights : -1, home = grade ? clamp01((since - b.lock) / 0.6) : 0;
            if (home > 0) dimBay(buf, home, ox, oy);
            // our Lander: where it is (its nose sits down in the bay once home), its shadow across the steel
            const ps = pose({ ...f, grade }, since), axis = [TAN[0] * Math.sin(ps.tilt), TAN[1] * Math.sin(ps.tilt), Math.cos(ps.tilt)];
            const nose3 = add(add(PF, TAN, ps.lat), UP, Math.max(0, ps.s) + Math.min(0, ps.s) * 0.5 - LANDER.seat), tail3 = add(nose3, axis, LANDER.len), mid3 = add(nose3, axis, LANDER.len / 2);
            const shadowPx = landerShadow(buf, nose3, tail3, ox, oy);
            if (RX) relayInfo.lit = 0;
            const dead = RX ? deadPoses(f, since, grade, side) : null;                                // LAST PORT: theirs too
            if (dead) dead.forEach(d => { if (d.shadow) landerShadow(buf, d.nose3, d.tail3, ox, oy); });
            if (grade && grade !== 'soft') scars(buf, grade, since, f, side, shift);
            // the bay's light pooling a little round it (gone once we are home); the port's own lamps while we are lined
            // up (and from the lock on, on a soft dock; from the ring's lights on, on any)
            const bay = shift(cam.project(PF)), bayR = BAY.half * cam.F / bay[2];
            if (home < 1) glow(buf, bay[0], bay[1], bayR * 1.8, R.AMBER, 0.34 * (1 - home));
            const portLit = grade ? (since > b.lock && grade === 'soft') || wave > 0 ? 1 : 0 : clamp01(f.lined || 0);
            const deadLamp = grade === 'rough' ? (side > 0 ? 0 : 1) : -1;                                    // the one a rough touch knocked out
            if (portLit > 0) PORT_LAMPS.forEach((p, j) => { const s = shift(cam.project(p)); if (s && j !== deadLamp && (portLit >= 1 || tick % 6 !== j)) lamp(buf, s[0], s[1], portLit, false); });
            // windows waking as the lights reach them (cold, a few warm)
            if (wave > 0) for (let k = 0; k < wake.length; k++) {
                const [i, du] = wake[k], ws = wave - 0.2 - du / Math.PI * 1.9;
                if (grade === 'crash' && du < BROKE.crash * 0.8) continue;                     // the windows by the strike stay dark
                if (ws < 0 || (ws < 0.12 && Math.floor(ws * 30) % 2)) continue;
                const x = i % AW + ox, y = (i / AW | 0) + oy, isWarm = hash(i, 2, 5) < 0.14;
                if (x >= 0 && x < AW && y >= 0 && y < AH) buf[y * AW + x] = (isWarm ? R.WARM : R.COLD).c32[level(isWarm ? R.WARM : R.COLD, (isWarm ? 0.5 : 0.42) + 0.3 * hash(i, 1, 3), x, y)];
            }
            // the running lights, blinking as the face's did; then the ring's own, group by group round from us, each
            // pooling on the steel under it more than it shines itself (a few never come on, a few flicker)
            RUNNING.forEach(p => { const s = shift(cam.project(p)); if (s && seen(s[0] - ox, s[1] - oy, s[2]) && tick % 8 < 4) { glow(buf, s[0], s[1], 3.5, R.PANEL, 0.7); lightPx(buf, s[0], s[1], R.PANEL, 1); } });
            let lightsOn = 0;
            if (wave > 0) RING_LIGHTS.forEach(l => {
                const ls = wave - (l.du / Math.PI) * 1.9 - l.j * 0.05;
                if (ls < 0 || (ls < 0.1 && Math.floor(ls * 30) % 2) || l.j < 0.06) return;
                if (l.j < 0.15 && hash(Math.floor(te * 9), l.du * 100, 5) < 0.3) return;
                const hurt = grade === 'crash' ? l.du < BROKE.crash : grade === 'rough' && l.sd === side && l.du < BROKE.rough;   // the strike broke the nearest
                if (hurt && (l.j < 0.6 || hash(Math.floor(te * 7), l.du * 100, 8) < 0.45)) return;
                const s = shift(cam.project(l.p));
                if (!s || !seen(s[0] - ox, s[1] - oy, s[2])) return;
                lightsOn++;
                const size = cam.F / s[2], k = Math.min(1, ls / 0.25) * l.b;
                pool(buf, s[0], s[1], s[2], Math.max(5, size * (l.big ? 15 : 10)), 0.42 * k, ox, oy);
                glow(buf, s[0], s[1], Math.max(1.6, size * (l.big ? 2.4 : 1.5)), R.COLD, 0.55 * k);
                lightPx(buf, s[0], s[1], R.COLD, 0.7 + 0.3 * k);
                if (l.big && size > 1.5) [[1, 0], [0, 1], [1, 1]].forEach(([a, c]) => lightPx(buf, s[0] + a, s[1] + c, R.COLD, 0.8 * k));
            });
            if (RX) sentScreen(buf, since, grade, ox, oy);                                              // LAST PORT: the screen on our collar
            // our Lander: how big and at what angle the camera sees it
            const pn = shift(cam.project(nose3)), pt = shift(cam.project(tail3)), pm = shift(cam.project(mid3));
            const jit = ps.rattle && !f.calm ? Math.round(ps.rattle * 1.6 * Math.sin(te * 61)) : 0, lenRaw = Math.hypot(pn[0] - pt[0], pn[1] - pt[1]);
            const len = Math.max(8, Math.round(lenRaw)), ht = Math.max(4, Math.round(LANDER.d * cam.F / pm[2] * 2) / 2);
            const deg = Math.round(Math.atan2(pn[1] - pt[1], pn[0] - pt[0]) * 180 / Math.PI), sp = lander(len, ht, deg), cx = pm[0] + jit, cy = pm[1] + (jit ? Math.round(ps.rattle * Math.cos(te * 53)) : 0);
            const ratio = clamp01(lenRaw / (LANDER.len * cam.F / pm[2])), cosT = Math.sqrt(1 - ratio * ratio);
            // the clamps behind our hull, the hull, its tail end, then the clamps in front of it
            const th = Math.max(1.5, 0.42 * cam.F / bay[2]);
            const arms = CORNERS.map((c, j) => {
                const [k, isLocked] = clampState({ ...f, grade }, since, j), toC = norm([c.at[0] - PF[0], c.at[1] - PF[1], 0]);
                const root = c.at, kneeOpen = add(add(root, toC, 0.7), UP, 1.6), tipOpen = add(add(root, toC, 1.5), UP, 2.5);
                const grip = add(add(PF, TAN, ps.lat), UP, 2.4 + Math.max(0, ps.s) - LANDER.seat), kneeShut = add(add(root, toC, 0.2), UP, 1.4), tipShut = add(grip, toC, LANDER.d / 2 + 0.12);
                const knee = [0, 1, 2].map(i => lerp(kneeOpen[i], kneeShut[i], k)), tip = [0, 1, 2].map(i => lerp(tipOpen[i], tipShut[i], k));
                const r2 = shift(cam.project(root)), k2 = shift(cam.project(knee)), t2 = shift(cam.project(tip));
                return { root: r2, knee: k2, tip: t2, isLocked, behind: t2[2] > pm[2], j };
            });
            if (dead) dead.forEach(d => { if (d.dist > pm[2]) drawDeadHull(buf, d, f, since, grade, th, ox, oy, shift); });   // LAST PORT: those behind us
            clampSide(buf, arms.filter(m => m.behind), th);
            blitSprite(buf, sp, cx, cy);
            const ax = (pt[0] - pn[0]) / (lenRaw || 1), ay = (pt[1] - pn[1]) / (lenRaw || 1), burn = ps.drive * (0.85 + 0.15 * Math.sin(te * 47));
            if (pt[2] < pn[2] && cosT > 0.15) endCap(buf, sp, cx, cy, ax, ay, len, ht, cosT, burn);
            warmWash(buf, sp, cx, cy, bay[0], bay[1], bayR * 2.2, 0.5 * clamp01(1 - Math.max(0, ps.s) / 5) * (1 - home));
            const broken = [...(f.holes || []), ...(f.broke >= 0 && since > 0 ? [f.broke] : [])];
            sp.ports.forEach((p, j) => {                                                                                    // our people's decks, lit from inside
                if (!(f.lit || [0, 2, 3, 4]).includes(j) || broken.includes(j)) return;
                if (RX) { glow(buf, cx + p[0], cy + p[1], winGlow, R.WARM, 0.62); dotPx(buf, cx + p[0], cy + p[1], R.AMBER, 0.95, Math.max(2, DOT)); return; }   // LAST PORT: as theirs will be
                dotPx(buf, cx + p[0], cy + p[1], R.AMBER, 0.9, DOT);
            });
            broken.forEach(j => {                                                                                          // a torn hole in every broken deck
                const p = sp.deck[j], ux = ax, uy = ay, hl = Math.max(1, len * 0.026), hw = Math.max(1.6, ht * 0.21), m = Math.ceil(hl + hw + 1);
                for (let yy = -m; yy <= m; yy++) for (let xx = -m; xx <= m; xx++) {
                    const a = xx * ux + yy * uy, w = -xx * uy + yy * ux, jag = hash(xx + 40 + j * 9, yy + 40, 17) * 0.9;
                    if (Math.abs(a) > hl + jag * 0.6 || Math.abs(w) > hw + jag) continue;
                    const lip = Math.abs(a) > hl + jag * 0.6 - 0.9 && a * (ux * LS[0] + uy * LS[1]) < 0;           // the torn edge that faces the light
                    inkPx(buf, cx + p[0] + xx, cy + p[1] + yy, lip ? R.RUST : R.HULL, lip ? 0.62 : 0.02);
                }
                if (j === f.broke && Math.floor(te * 6) % 3) dotPx(buf, cx + p[0], cy + p[1], R.RED, 0.75, DOT);           // a red light blinking in the new one
            });
            if (f.broke >= 0 && since > 0.3) { const p = sp.deck[f.broke]; vent(buf, cx + p[0], cy + p[1], ay, -ax, since, 22 * FXS, 0.65); }   // its air, going
            if (tick % 12 < 2) { if (FX > 2) glow(buf, cx + sp.lamp[0], cy + sp.lamp[1], 3 * FXS, R.RED, 0.7); dotPx(buf, cx + sp.lamp[0], cy + sp.lamp[1], R.RED, 0.9, DOT); }   // our nav lamp
            clampSide(buf, arms.filter(m => !m.behind), th);
            if (grade === 'rough' && since > 0.25) {                                                                      // the knocked rim, venting slowly
                const o = shift(cam.project(add(add(add(PF, TAN, knockAt(f, side)), RAD, 0.6), UP, 0.2))), vx = AX.along[0] * side * 0.85 + AX.up[0] * 0.5, vy = AX.along[1] * side * 0.85 + AX.up[1] * 0.5, vn = Math.hypot(vx, vy) || 1;
                if (o) vent(buf, o[0], o[1], vx / vn, vy / vn, since, 30 * FXS, 0.8);
            }
            // the drive at the bell, out along our axis; the nose thrusters braking us
            const bx = cx + sp.bell[0], by = cy + sp.bell[1];
            if (burn > 0.02) {
                const reach = (3 + 18 * burn) * FX ** 0.8, wide = (0.8 + 1.6 * burn) * FXS, ww = Math.ceil(3 * FXS);
                glow(buf, bx + ax * 2, by + ay * 2, (4 + 9 * burn) * FXS, R.PLUME, 0.55 * burn);
                for (let k = 0; k < reach; k += 0.5) for (let w = -ww; w <= ww; w++) {
                    const v = (1 - k / reach) ** 1.3 * Math.exp(-(w * w) / (wide * wide * (1 + k * 0.08)));
                    if (v > 0.06) lightPx(buf, bx + ax * k - ay * w * 0.7, by + ay * k + ax * w * 0.7, R.PLUME, Math.min(1, v * (0.5 + 0.7 * burn)));
                }
            }
            if (ps.brake && tick % 3 !== 2) [-1, 1].forEach(sd => {                                                       // short puffs ahead of the nose
                const nx = cx + sp.nose[0] - ax * 3 + ay * sd * ht * 0.42, ny = cy + sp.nose[1] - ay * 3 - ax * sd * ht * 0.42;
                const n = Math.round(6 * FXS);
                for (let k = 0; k < n; k++) dotPx(buf, nx - ax * k * 0.9 + ay * sd * k * 0.6, ny - ay * k * 0.9 - ax * sd * k * 0.6, R.PLUME, 0.85 - k / n * 0.7, k < n / 2 ? DOT : 1);
            });
            if (dead) dead.forEach(d => { if (d.dist <= pm[2]) drawDeadHull(buf, d, f, since, grade, th, ox, oy, shift); });   // LAST PORT: those in front of us
            if (grade) drawStrike(buf, grade, since, f, side, shift, sp, cx, cy);
            lastFrame = { te: +te.toFixed(2), since: +since.toFixed(2), s: +ps.s.toFixed(2), lat: +ps.lat.toFixed(2), len, ht, deg, cosT: +cosT.toFixed(2), shadowPx, shBox, home: +home.toFixed(2), lightsOn, portLit, wake: wake.length, holes: broken.length, clamps: arms.map(m => m.isLocked), ...(RX ? { relay: { ...relayInfo } } : {}) };
        }
        /** The touch: a soft one breathes a little air out of the seal; a rough one knocks the rim (a flash, sparks off
            along it, more as it scrapes into place); a hard one strikes (a big flash, a burst of sparks, pieces that drift
            on) and the panel off our broken deck tumbles away over open space. */
        function drawStrike(buf, grade, since, f, side, shift, sp, cx, cy) {
            if (since < 0) return;
            if (grade === 'soft') {
                if (since > 0.9) return;
                const o = shift(cam.project(PF));
                burst.puff.forEach(p => { const k = since / 0.9, x = o[0] + p.dx * p.sp * FX * since * 1.6, y = o[1] + p.dy * p.sp * FX * since * 1.6; if (FX > 2) glow(buf, x, y, 2 * FXS, R.ICE, 0.5 * (1 - k)); lightPx(buf, x, y, R.ICE, 0.75 * (1 - k)); });
                return;
            }
            const isCrash = grade === 'crash', lat0 = clamp(f.lat || 0, -1, 1) * LAT_M;
            const hit = shift(cam.project(add(PF, TAN, isCrash ? lat0 : side * clamp(Math.abs(lat0) + LANDER.d / 2, BAY.half + 0.15, COL.half - 0.3))));   // a rough one knocks the rim on the side we were off
            const flashT = isCrash ? 0.4 : 0.18;
            if (since < flashT) { const k = 1 - since / flashT; glow(buf, hit[0], hit[1], (isCrash ? 40 : 22) * FXS * (0.6 + 0.4 * k), R.SUN, (isCrash ? 1.5 : 1.2) * k); }
            burst.sparks.forEach(s => {
                const age = since - s.at;
                if (age < 0 || age > s.life) return;
                spark(buf, hit[0] + s.dx * s.sp * FX * age, hit[1] + s.dy * s.sp * FX * age, s.dx, s.dy, 1 - age / s.life);
            });
            burst.bits.forEach((p, j) => {                                                                             // out of the flash, then drifting on
                const t = since - 0.1;
                if (t < 0) return;
                const d = 3 * FX + p.sp * FX * (1 - Math.exp(-t * 3)) / 3 + p.coast * FX * t, x = hit[0] + p.dx * d, y = hit[1] + p.dy * d, lit = Math.cos(p.spin * t + j) > 0;
                dotPx(buf, x, y, R.HULL, lit ? 0.8 : 0.25, DOT); if (p.w > 1) dotPx(buf, x + DOT, y, R.HULL, lit ? 0.55 : 0.15, DOT); if (p.w > 2) dotPx(buf, x, y + DOT, R.HULL, 0.2, DOT);
            });
            if (!isCrash || f.broke < 0) return;
            if (!burst.panel) { const d = sp.deck[f.broke]; burst.panel = { x: cx + d[0], y: cy + d[1] }; }   // where our deck was at the strike
            // off the face and in, over the open hole: thrown, then drifting, slowly turning over, a little nearer us
            const k = since, push = 30 * (1 - Math.exp(-k * 2.2)) + 3.5 * k, vx = -side * AX.along[0] * 0.8 + AX.up[0] * 0.45 - AX.across[0] * 0.3, vy = -side * AX.along[1] * 0.8 + AX.up[1] * 0.45 - AX.across[1] * 0.3, vn = Math.hypot(vx, vy) || 1;
            const x = burst.panel.x + vx / vn * push * FX, y = burst.panel.y + vy / vn * push * FX, a = 1.25 * k + 0.4, sc = 1 + 0.05 * k, face = Math.cos(a * 0.8);
            const pz = Math.min(FXS, 1.6), w = 6 * sc * pz, h = 3.6 * sc * pz * (0.3 + 0.7 * Math.abs(face)), ca = Math.cos(a), sa = Math.sin(a), m = Math.ceil(w + 1);
            for (let yy = -m; yy <= m; yy++) for (let xx = -m; xx <= m; xx++) {
                const u = xx * ca + yy * sa, v = -xx * sa + yy * ca;
                if (Math.abs(u) > w || Math.abs(v) > h) continue;
                const edge = Math.abs(v) > h - 1 || Math.abs(u) > w - 1;
                if (face > 0) {                                                                                         // its outside: our hull plate, a seam, a porthole
                    const port = Math.hypot((u - w * 0.42) / Math.max(1, h * 0.55), v / Math.max(1, h * 0.55));
                    inkPx(buf, x + xx, y + yy, R.HULL, edge ? (v * (ca * LS[1] - sa * LS[0]) < 0 ? 0.95 : 0.2) : port < 1 ? (port > 0.7 ? 0.5 : 0.06) : Math.abs(u + w * 0.2) < 0.6 ? 0.42 : 0.7 + 0.08 * (hash(xx, yy, 7) - 0.5));
                } else inkPx(buf, x + xx, y + yy, R.RUST, edge ? 0.7 : (((u / Math.max(2, w * 0.4)) % 1 + 1) % 1) < 0.2 ? 0.22 : 0.45);   // its inside: ribs, torn
            }
            if (face > 0.95) { lightPx(buf, x, y, R.STAR, 1); [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([p, q]) => lightPx(buf, x + p, y + q, R.STAR, 0.6)); }   // it catches the light
        }
        return { bake, beats, draw, reset: () => { burst = null; }, isDone: () => done, debug: () => ({ done, row, bakeMs: Math.round(bakeMs), ...lastFrame }) };
    }

    window.DockExterior = Object.freeze({ create, shotAt });
})();
