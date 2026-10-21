/* TorchDoors.js — boarding one of our wrecks is not the same hatch cut every time (2026-10-17; played by Torch.js).
   The game picks one door per boarding (pick). Torch.js plays the three that need the torch; this file says what every door
   is (its geometry and its pictures, painted over Torch's hull close up) and plays the three that need no torch.

   THE DOORS
     cut      the hatch cut along its seam (Torch.js as it always was): the first boarding of a run, and at most once more
     frozen   frost hides the seam (the dark sectors 2 and 5): warm it off with the flame held back, then cut the stretches the
              ice has not already split (about a third of the seam); the corridor inside is iced over
     fuel     a fuel line crosses the seam, marked red by the suit: cut the seam but stop either side of the line; the flame on
              it is a scar and a spray of frozen vapour; when the hatch goes the line snaps at the seam. It runs one of two ways
     already  (from sector 3) the hatch was cut open long ago: the lander's lamp sweeps over the dark hull, finds the old cold
              cut, and the loose door tips out of its frame. The spotter: "Somebody cut this open before us."
     torn     the hull beside the hatch is split open: no torch. Jaxon floats over and climbs in through the split, the spotter
              after him. The cutter: "No need for the torch. We go in through the side."
     panel    the airlock still has a little power: the cutter wires its panel; "Hold it" (a held press, about two seconds) while
              the panel's lights climb; the airlock cycles and its door slides open on a dim light inside
   A door without the torch is a short picture with a line; any click (or Enter) or about four seconds moves on.
   ON THE GROUND (place 'ground', TorchGround.js): the same doors on the world's own soil. Nobody floats or has a line: Jaxon
   walks in, over to the split and climbs in, or stands at the airlock's panel (lower on the hull, where he can reach it from
   the soil); the cables in a split hull hang down; the loose door falls back into the wreck with a thud; sparks fall.

   THE RULE (pick): never the same door twice in a row; the first boarding is the cut, and the cut comes back at most once; after
   it about half the boardings are a picture; frozen only on a cold world (-10 °C or colder; a wreck whose world is not known:
   only in the dark sectors 2 and 5), the fuel line (its fuel frozen) never on a hot one (35 °C or hotter), already from
   sector 3; a wreck whose story still has power aboard leans to the panel, one with wrecked decks to the split hull. Seeded by
   the hull number and the sector, so a reload gives the same door.

   window.TorchDoors = { KINDS, PLAYED, BEATS, has(kind), isBeat(kind), pick(history, { hull, sector, story, temp }),
                         geometry(setup), art(setup), mountBeat(ctx, ui, setup, kit) }   (the last three are for Torch.js)
   Needs MiniLab, MiniPaint, MiniCrew and Torch.js (window.MiniTorchKit): load right after Torch.js. Sound only while the
   game's sound is on (Torch's own sound kit). Reduced motion: no flicker and no flashing. */
(function () {
    'use strict';
    const MiniLab = window.MiniLab, K = window.MiniTorchKit;
    if (!MiniLab || !K) return;
    const C = MiniLab.C, W = K.W, HB = K.HB, clamp = MiniLab.clamp, lerp = MiniLab.lerp;
    const ease = k => { const c = clamp(k, 0, 1); return c * c * (3 - 2 * c); };
    const reduced = () => !!(window.Juice && window.Juice.reduced());

    const KINDS = ['cut', 'frozen', 'fuel', 'already', 'torn', 'panel'], PLAYED = ['cut', 'frozen', 'fuel'], BEATS = ['already', 'torn', 'panel'];
    const isBeat = k => BEATS.includes(k);

    // ── which door a boarding gets ──
    const WEIGHT = { cut: 0.25, frozen: 2.4, fuel: 1.4, already: 1.6, torn: 1, panel: 1 };   // within its group: a cold world's frost is likely, the plain cut rarely comes back
    const STORY_FIT = { EXODUS_CRYO: 'panel', EXODUS_PARTIAL: 'panel', EXODUS_CACHE: 'torn' };   // the wreck's own story: power still aboard; its decks wrecked
    const roll = (...keys) => {                                  // 0..1 from whole numbers: the same wreck and history always roll the same
        let h = 2166136261;
        keys.forEach(v => { h = Math.imul(h ^ (v | 0), 16777619); h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; });
        return (h >>> 0) / 4294967296;
    };
    const COLD_AT = -10, HOT_AT = 35;                            // °C: frost on a hatch at or below; frozen fuel in a line never at or above
    /** The door for this boarding. history: this run's doors so far, oldest first. wreck: { hull (number), sector, story (its id),
        temp (its world's °C; missing: not known, as in space) }. */
    function pick(history, wreck) {
        const past = (Array.isArray(history) ? history : []).filter(k => KINDS.includes(k)), w = wreck || {};
        if (!past.length) return 'cut';                          // the first boarding of a run teaches the torch
        const hull = Math.abs(Math.round(Number(w.hull) || 0)), sector = clamp(Math.round(Number(w.sector) || 1), 1, 6), last = past[past.length - 1];
        const temp = w.temp == null || w.temp === '' || !Number.isFinite(Number(w.temp)) ? null : Number(w.temp);
        const cold = temp == null ? sector === 2 || sector === 5 : temp <= COLD_AT, hot = temp != null && temp >= HOT_AT;   // the world decides; unknown: the dark sectors
        const after = past.slice(1), beats = after.filter(isBeat).length, plays = after.length - beats;
        const fits = k => k !== last && (k !== 'cut' || past.filter(x => x === 'cut').length < 2)
            && (k !== 'frozen' || cold) && (k !== 'fuel' || !hot) && (k !== 'already' || sector >= 3);
        const wantBeat = roll(hull, sector, past.length, 1) < clamp(0.5 + 0.2 * (plays - beats), 0.25, 0.75);   // about half of them are a picture
        const play = PLAYED.filter(fits), beat = BEATS.filter(fits);
        const onlyCut = play.length === 1 && play[0] === 'cut' && beat.length && roll(hull, sector, past.length, 3) < 0.7;   // the plain cut as the only torch door left: usually a picture instead
        const first = wantBeat || onlyCut ? beat : play, group = first.length ? first : wantBeat ? play : beat;
        const recent = past.slice(-3), seen = k => past.filter(x => x === k).length;
        const weightOf = k => WEIGHT[k] * (STORY_FIT[w.story] === k ? 2.5 : 1) * (recent.includes(k) ? 0.3 : 1) * (seen(k) >= 2 ? 0.5 : 1);   // what came lately, or twice already, is less likely
        let r = roll(hull, sector, past.length, 2) * group.reduce((sum, k) => sum + weightOf(k), 0);
        return group.find(k => (r -= weightOf(k)) < 0) || group[group.length - 1] || 'cut';
    }

    // ── FROZEN: the stretches of the seam that still hold (three, about a third of it); the ice split the rest ──
    function iceHolds(seed) {
        const r = MiniLab.rng(seed * 7919 + 13), t0 = r();
        return [0, 1, 2].map(k => { const c = (t0 + k / 3 + (r() - 0.5) * 0.1 + 1) % 1, half = 0.05 + r() * 0.025; return [c - half, c + half]; });
    }
    const inStretch = (t, [a, b]) => [t - 1, t, t + 1].some(v => v >= a && v <= b);
    const holdsAt = (holds, x, y) => {                           // is the seam at (x, y) one that still holds?
        let best = 0, bd = 1e9;
        K.PATH.forEach((p, j) => { const dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < bd) { bd = dd; best = j; } });
        return holds.some(h => inStretch(best / K.STEPS, h));
    };

    // ── FUEL LINE: the line (units), its distance, where it crosses the seam, what the suit marks ──
    const PIPE_R = 2.2, LINE_TOUCH = PIPE_R + 1.2, LINE_CLEAR = 6.5, MARK_OFF = PIPE_R + 1.6, MARK_NEAR = 30, CLAMP_EVERY = 18;
    const FUEL_ROUTES = [                                        // up from below, along under the hatch's sill, then across its lower right and away along the hull;
        [[262, 292], [262, 189], [318, 189], [380, 127], [490, 127]],   // or down over the hull's edge, close beside the hatch, then across its lower right and down
        [[370, 4], [370, 124], [342, 152], [342, 292]],
    ];
    const lines = new Map();
    function fuelLine(seed) {
        const key = Math.abs(seed) % FUEL_ROUTES.length;
        if (lines.has(key)) return lines.get(key);
        const pts = FUEL_ROUTES[key], segs = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
            segs.push({ ax, ay, ux: (bx - ax) / len, uy: (by - ay) / len, len, s0: total }); total += len;
        }
        function near(x, y) {                                    // the nearest point on the line: its distance, where, how far along, which way it runs
            let best = null;
            for (const g of segs) {
                const t = clamp((x - g.ax) * g.ux + (y - g.ay) * g.uy, 0, g.len), px = g.ax + g.ux * t, py = g.ay + g.uy * t, dd = Math.hypot(x - px, y - py);
                if (!best || dd < best.d) best = { d: dd, px, py, s: g.s0 + t, ux: g.ux, uy: g.uy };
            }
            return best;
        }
        const pointAt = s => { const g = segs.find(q => s <= q.s0 + q.len) || segs[segs.length - 1], t = clamp(s - g.s0, 0, g.len); return { x: g.ax + g.ux * t, y: g.ay + g.uy * t, ux: g.ux, uy: g.uy }; };
        const crossings = [];                                    // where it crosses the seam; dir: along it, into the hatch (the way the vapour goes when it snaps)
        for (let s = 0.25, was = K.sdf(pts[0][0], pts[0][1]); s <= total; s += 0.25) {
            const q = pointAt(s), now = K.sdf(q.x, q.y);
            if ((was > 0) !== (now > 0)) { const into = now < 0 ? 1 : -1; crossings.push({ x: q.x, y: q.y, s, dir: { x: q.ux * into, y: q.uy * into } }); }
            was = now;
        }
        const inZone = K.PATH.map(p => near(p.x, p.y).d < LINE_CLEAR), stops = [];   // a bar across the seam where the cut has to stop
        K.PATH.forEach((p, j) => {
            const nx = (j + 1) % K.STEPS;
            if (inZone[j] === inZone[nx]) return;
            const q = inZone[j] ? K.PATH[nx] : p, n = K.normal(q.x, q.y);
            stops.push({ x: q.x, y: q.y, nx: n.x, ny: n.y });
        });
        const marks = [];                                        // the suit's marks either side of the line, near the hatch
        for (let s = 0; s <= total; s += 0.5) {
            const q = pointAt(s);
            if (Math.abs(K.sdf(q.x, q.y)) > MARK_NEAR || q.y < K.horizon(q.x) + 1) continue;
            const j = Math.round(s * 2);
            marks.push({ x: q.x - q.uy * MARK_OFF, y: q.y + q.ux * MARK_OFF, j }, { x: q.x + q.uy * MARK_OFF, y: q.y - q.ux * MARK_OFF, j });
        }
        const clamps = [];                                       // pipe clamps on the hull, never on the hatch or at a bend
        for (let s = 9; s < total - 4; s += CLAMP_EVERY) {
            const q = pointAt(s), bend = segs.some(g => Math.abs(s - g.s0) < 5 && g.s0 > 0);
            if (!bend && K.sdf(q.x, q.y) > 6 && q.y > K.horizon(q.x) + 3) clamps.push(s);
        }
        const free = [];                                         // the seam the suit keeps clear: it never needs cutting
        K.SEAM.forEach((i, k) => { const x = i % W; if (near(x, (i - x) / W).d < LINE_CLEAR) free.push(k); });
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const line = Object.freeze({
            r: PIPE_R, touch: LINE_TOUCH, clear: LINE_CLEAR, near, crossings, stops, marks, clamps, free,
            box: [Math.min(...xs) - 5, Math.min(...ys) - 5, Math.max(...xs) + 5, Math.max(...ys) + 5],
            dist: (x, y) => near(x, y).d,
            normal: (x, y) => { const n = near(x, y); return { x: -n.uy, y: n.ux }; },
        });
        lines.set(key, line);
        return line;
    }

    /** What Torch.js needs to play this door: { free: seam pixels that need no cut, line (FUEL LINE), holds (FROZEN) }. */
    function geometry(o) {
        if (o.door === 'fuel') { const line = fuelLine(o.seed); return { free: line.free, line }; }
        if (o.door !== 'frozen') return {};
        const holds = iceHolds(o.seed), free = [];
        K.SEAM_STEP.forEach((j, k) => { if (!holds.some(h => inStretch(j / K.STEPS, h))) free.push(k); });
        return { free, holds };
    }

    // ── the pictures: each door's own, painted once over Torch's hull (art pixels, density d) ──
    const P = () => window.MiniPaint;

    /** FROZEN: where the ice has split the seal, a dark gap rimmed with ice (hidden under the frost until it melts). */
    function crackPainter(holds) {
        return (p, d, RR) => {
            const M = P();
            K.eachArt(d, K.HATCH_BOX[0] - 3, K.HATCH_BOX[1] - 3, K.HATCH_BOX[2] + 3, K.HATCH_BOX[3] + 3, (ax, ay, x, y) => {
                const sd = Math.abs(K.sdf(x, y));
                if (sd > 2.3 || holdsAt(holds, x, y)) return;
                if (sd <= 1.3) {                                 // the split, forced open and packed with ice
                    const ice = M.vnoise(x / 1.6, y / 1.6, 92) + 0.3 * M.vnoise(x / 0.7, y / 0.7, 94);
                    return ice > 0.72 ? p.solid(ax, ay, RR.FROST, 0.5 + 0.4 * (ice - 0.72) * 2.4) : p.solid(ax, ay, RR.HULL, 0.004);
                }
                if (M.hash(ax, ay, 93) < 0.5) p.solid(ax, ay, RR.FROST, 0.3 + 0.3 * (2.3 - sd));   // its lips, pushed apart and rimed
            });
        };
    }
    /** FROZEN: the corridor behind rimed with frost, thickest by the opening; icicles off the ceiling ribs; a crystal far in. */
    function icedInside(p, d, RR) {
        const M = P(), RIBS = [0.42, 0.56, 0.76];
        K.eachArt(d, ...K.HATCH_BOX, (ax, ay, x, y) => {
            const dd = K.sdf(x, y);
            if (dd > -4) return;                                 // the plate's cut edge stays as it is
            const qx = Math.abs(x - K.VP.x) / HB.hw, qy = Math.abs(y - K.VP.y) / HB.hh, q = Math.max(qx, qy);
            if (q <= 0.3) { if (M.hash(ax, ay, 95) < 0.005) p.solid(ax, ay, RR.FROST, 0.8); return; }
            const ceiling = y < K.VP.y && qy > qx, rib = RIBS.some(r => Math.abs(q - r) < 0.012);
            const icicle = ceiling && RIBS.some(r => {          // short icicles hang off the ribs across the ceiling
                const y0 = K.VP.y - r * HB.hh, len = (1.6 + 3.2 * M.hash(Math.round(x / 3), Math.round(r * 100), 98)) * r * 1.6;
                return y >= y0 && y < y0 + len && Math.abs(((x / 3) % 1 + 1) % 1 - 0.5) < 0.24 * (1 - (y - y0) / len);
            });
            if (icicle) return p.solid(ax, ay, RR.FROST, 0.55 + 0.35 * (1 - (q - 0.3)));
            const rime = M.smooth(0.34, 0.95, q) * (0.5 + 0.5 * M.fbm(x / 4, y / 4, 96, 2)) + (rib ? 0.35 : 0) + (y > K.VP.y && qy > qx ? 0.1 : 0);
            if (MiniLab.on(ax + 2, ay + 1, rime * 0.85)) p.solid(ax, ay, RR.FROST, 0.3 + 0.42 * rime + (M.hash(ax, ay, 97) < 0.02 ? 0.3 : 0));
        });
    }

    /** FUEL LINE: the pipe on the hull and across the hatch: clamped, a breakaway coupling where it crosses the seam, rimed
        where the cold fuel inside froze; its shadow down and to the left. Painted into the hull, so the hatch takes its part. */
    function pipePainter(line) {
        return (p, d, RR) => {
            const M = P(), r = line.r;
            K.eachArt(d, ...line.box, (ax, ay, x, y) => {
                if (y < K.horizon(x) + 0.5) return;              // over the hull's edge it is out of sight
                const n = line.near(x, y), coupling = line.crossings.find(c => Math.abs(n.s - c.s) < 2), clampAt = line.clamps.find(s => Math.abs(n.s - s) < 0.9);
                const R = r + (coupling ? 1.1 : clampAt != null ? 0.8 : 0);
                if (n.d >= R) { if (line.near(x + 1.4, y - 1.4).d < r) p.solid(ax, ay, RR.HULL, 0.025); return; }
                const n1x = n.uy, n1y = -n.ux, lit = n1x - n1y >= 0 ? 1 : -1;   // its lit side: towards the light, up and right
                const o = ((x - n.px) * n1x + (y - n.py) * n1y) * lit / R, nz = Math.sqrt(Math.max(0, 1 - o * o));
                let v = 0.07 + 0.52 * Math.max(0, 0.72 * o + 0.6 * nz) + (o > 0.35 && o < 0.7 ? 0.12 : 0);
                if (coupling) { const a = Math.abs(n.s - coupling.s); v = a < 0.35 || Math.abs(a - 1.5) < 0.3 ? 0.04 : v + 0.18; }   // a fat ring, grooved: the breakaway coupling
                else if (clampAt != null) v = Math.abs(o) > 0.86 ? 0.62 : v + 0.16;   // a clamp band, its bolts catching the light
                else if (o > 0.1 && M.fbm(x / 3, y / 3, 121, 2) > 0.58) return p.solid(ax, ay, RR.ICE, 0.42 + 0.4 * o);   // frost on top of it
                p.solid(ax, ay, RR.HULL, v);
            });
        };
    }

    /** ALREADY CUT: the old cut round the hatch, long cold: a dark slot that wanders a little, slag gone to rust on its lips,
        the scorch the flame left where it lingered. */
    function oldCutPainter(seed) {
        return (p, d, RR) => {
            const M = P(), s = 101 + (seed % 7);
            K.eachArt(d, K.HATCH_BOX[0] - 9, K.HATCH_BOX[1] - 9, K.HATCH_BOX[2] + 9, K.HATCH_BOX[3] + 9, (ax, ay, x, y) => {
                const e = Math.abs(K.sdf(x, y) - (M.vnoise(x / 6, y / 6, s) - 0.5) * 1.6);
                if (e < 1.05) return p.solid(ax, ay, RR.HULL, M.hash(ax, ay, 102) < 0.05 ? 0.22 : 0.012);
                if (e < 2.1) {
                    const h = M.hash(ax, ay, 103);
                    if (h < 0.16) return p.solid(ax, ay, RR.HULL, 0.48 + 0.3 * h);
                    return h < 0.62 ? p.solid(ax, ay, RR.RUST, 0.3 + 0.45 * M.vnoise(ax / 2, ay / 2, 104)) : p.solid(ax, ay, RR.HULL, 0.06);
                }
                const reach = 2.1 + 5 * M.fbm(x / 9, y / 9, 105, 2);
                if (e < reach && MiniLab.on(ax, ay, 0.55 * (1 - (e - 2.1) / Math.max(0.1, reach - 2.1)))) p.solid(ax, ay, RR.HULL, 0.035);
            });
        };
    }

    // ── TORN: the split in the hull beside the hatch (units; jagged, widest at the middle) ──
    let tearMemo = null;
    function tearShape() {
        if (tearMemo) return tearMemo;
        const M = P(), top = 34, bot = 234;
        const mid = y => 405 + 7 * (y - top) / (bot - top) + 3 * Math.sin((y - top) / 23);
        const half = y => 19 * Math.pow(Math.max(0, Math.sin(Math.PI * (y - top) / (bot - top))), 0.62);
        const fingers = seed => {                                // a few fingers of torn plate sticking into the gap, none alike
            const r = MiniLab.rng(seed), list = [];
            for (let y = top + 12 + r() * 10; y < bot - 14; y += 11 + r() * 19) list.push({ y, len: 2.5 + r() * 6, w: 1.5 + r() * 3 });
            return list;
        };
        const FL = fingers(4021), FR = fingers(7703);
        const finger = (list, y) => list.reduce((m, f) => Math.max(m, f.len * Math.max(0, 1 - Math.abs(y - f.y) / f.w)), 0);
        const ragged = (y, s) => (M.fbm(y / 8, s, 112, 3) - 0.5) * 2;   // the edge wanders, slow and uneven
        const left = y => mid(y) - half(y) * (0.84 + 0.36 * ragged(y, 1.5)) + (half(y) > 4 ? finger(FL, y) : 0);
        const right = y => mid(y) + half(y) * (0.84 + 0.36 * ragged(y, 7.5)) - (half(y) > 4 ? finger(FR, y) : 0);
        const outline = [];                                      // for keeping people inside it as they climb in
        for (let y = top; y <= bot; y += 1.5) outline.push([left(y), y]);
        for (let y = bot; y >= top; y -= 1.5) outline.push([right(y), y]);
        const creases = [[-1, 84, 2.7, 11], [-1, 170, 3.2, 13], [1, 112, 0.25, 12], [1, 196, -0.3, 10]]   // folds running out from the split
            .map(([side, y, a, len]) => ({ x: side < 0 ? left(y) - 2.6 : right(y) + 2.2, y, ux: Math.cos(a), uy: Math.sin(a), len }));   // a: the way it runs (left of the split, leftwards)
        tearMemo = { top, bot, mid, half, left, right, outline, creases };
        return tearMemo;
    }
    function tearPainter(p, d, RR, hanging) {   // hanging: on the ground, the cables out of the split hang down
        const M = P(), T = tearShape();
        K.eachArt(d, 360, T.top - 14, 456, T.bot + 14, (ax, ay, x, y) => {
            if (y < K.horizon(x) + 1) return;
            const l = T.left(y), r = T.right(y), rows = y > T.top && y < T.bot;
            if (rows && x > l && x < r) { const [ramp, v] = tearInside(x, y, l, r, ax, ay, M, RR); return p.solid(ax, ay, ramp, v); }
            const wl = 2.4 + 2.4 * M.vnoise(y / 7, 3.3, 116), wr = 1.4 + 1.6 * M.vnoise(y / 6, 9.1, 117);   // how far the plate is bent back either side
            if (rows && x <= l && x > l - wl) {                  // the near lip, bent out towards our lamp: brighter towards its torn edge, the edge itself bright
                const k = (l - x) / wl;
                if (k < 0.12) return p.solid(ax, ay, RR.LIT, 0.84);
                return p.solid(ax, ay, M.hash(ax, ay, 114) < 0.12 ? RR.RUST : RR.LIT, 0.66 - 0.36 * k);
            }
            if (rows && x >= r && x < r + wr) return p.solid(ax, ay, RR.HULL, (x - r) / wr < 0.2 ? 0.5 : 0.03 + 0.05 * (x - r) / wr);   // the far lip, turned away: dark, its torn edge bright
            for (const c of T.creases) {                         // the plating buckled: a fold, dark with a lit side
                const t = (x - c.x) * c.ux + (y - c.y) * c.uy;
                if (t < 0 || t > c.len) continue;
                const o = (x - c.x) * -c.uy + (y - c.y) * c.ux, w = 0.9 * (1 - t / c.len);
                if (Math.abs(o) < w) return p.solid(ax, ay, RR.HULL, o < 0 ? 0.03 : 0.5);
            }
        });
        const cables = hanging ? [[[T.mid(118) + 2, 118], [430, 128], [431, 152]], [[T.mid(162) - 3, 162], [390, 172], [389, 196]], [[T.mid(92) + 4, 92], [425, 100], [428, 117]]]   // on the ground they hang
            : [[[T.mid(118) + 2, 118], [432, 112], [438, 133]], [[T.mid(162) - 3, 162], [384, 168], [391, 196]], [[T.mid(92) + 4, 92], [426, 86], [433, 79]]];   // cables floating out of it
        cables.forEach(([a, b, c]) => {
            for (let t = 0; t <= 1; t += 0.004) {
                const u = 1 - t, x = u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], y = u * u * a[1] + 2 * u * t * b[1] + t * t * c[1];
                if (x > T.left(y) && x < T.right(y) && t < 0.3) continue;   // in the dark it cannot be seen
                const axp = Math.floor((x + 0.5) * d), ayp = Math.floor((y + 0.5) * d);
                p.solid(axp, ayp, RR.HULL, 0.08); p.solid(axp, ayp - 1, RR.HULL, 0.45);
            }
            const ex = Math.floor((c[0] + 0.5) * d), ey = Math.floor((c[1] + 0.5) * d);
            [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([ox, oy]) => p.solid(ex + ox, ey + oy, RR.HULL, oy ? 0.3 : 0.7));   // its plug
        });
    }
    function tearInside(x, y, l, r, ax, ay, M, RR) {             // inside: the hull's frame and a broken deck, our lamp on their near edges, dark beyond → [ramp, tone]
        const T = tearShape(), u = (x - l) / Math.max(1, r - l), lamp = Math.max(0, 1 - u * 1.1) * Math.exp(-Math.abs(y - 160) / 80);
        const rib = x - (T.mid(y) - 5), rib2 = x - (T.mid(y) + 9);
        if (rib > -2.2 && rib < 2.2) return rib < -1.1 ? [RR.LIT, 0.34 + 0.4 * lamp] : [RR.HULL, 0.1 + 0.14 * lamp];   // a frame member, its near face in our lamp
        if (rib2 > -1.4 && rib2 < 1.4) return [RR.HULL, rib2 < -0.6 ? 0.1 + 0.12 * lamp : 0.05];   // another, further back
        const deck = 150 + 4 * u - 3 * Math.max(0, u - 0.6);     // a deck, broken where the hull split
        if (y > deck && y < deck + 5) return y < deck + 1.5 ? [RR.LIT, 0.36 + 0.42 * lamp] : y > deck + 4 ? [RR.HULL, 0.01] : [RR.HULL, 0.12 + 0.12 * lamp];
        const panel = ((y - 40) / 26) % 1;                       // the inner wall's panels, far back
        let v = 0.025 + 0.09 * lamp + (panel < 0.05 ? -0.02 : 0);
        if (Math.abs(x - (T.mid(y) + 6 + 2 * Math.sin(y / 9))) < 0.7 && y > 60 && y < 142) v = 0.14 + 0.14 * lamp;   // a loose cable hanging inside
        return [RR.HULL, v + (M.hash(ax, ay, 115) < 0.006 ? 0.24 : 0)];
    }

    // ── LIVE PANEL: the airlock's panel beside the hatch (units) and the airlock behind the door ──
    const PANEL_AT = { box: [257, 97, 276, 130], screen: [259.5, 99.5, 274, 107.5], label: [259.6, 109.4], lights: [271, 113, 274, 128], lever: [259.5, 114, 266, 128], port: [258.6, 129.4] };
    const LIGHTS = 6;
    /** The panel's parts (units): as built in space; on the ground lower down the hull, its lever where Jaxon's hands are when he
        stands on the soil beside it (TorchGround.standAt), so nobody floats up to it. */
    function panelOf(o) {
        const TG = window.TorchGround, dy = TG && TG.is(o) ? Math.round(TG.standAt(PANEL_AT.lever[0] + 2.5 - 0.33 * K.JAX.H, o) - 0.7 * K.JAX.H - (PANEL_AT.lever[1] + 5)) : 0;
        const down = v => v.map((q, i) => (i % 2 ? q + dy : q));
        return Object.fromEntries(Object.entries(PANEL_AT).map(([k, v]) => [k, down(v)]));
    }
    const lightBox = (PANEL, n) => { const [x0, y0, x1, y1] = PANEL.lights, h = (y1 - y0) / LIGHTS; return [x0, y1 - (n + 1) * h + 0.35, x1, y1 - n * h - 0.35]; };   // the lights climb from the bottom
    const panelPainter = PANEL => (p, d, RR) => {
        const M = P(), [x0, y0, x1, y1] = PANEL.box, inside = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
        K.eachArt(d, x0 - 2, y0 - 2, x1 + 2, y1 + 2, (ax, ay, x, y) => {
            if (!inside(PANEL.box, x, y)) {                      // its shadow on the hull: our lamp is below and to the left
                if ((x > x1 && x < x1 + 1.3 && y > y0 - 1.3 && y < y1 - 1) || (y < y0 && y > y0 - 1.3 && x > x0 + 1 && x < x1 + 1.3)) p.solid(ax, ay, RR.HULL, 0.03);
                return;
            }
            const edge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
            if (edge < 0.55) return p.solid(ax, ay, RR.HULL, 0.02);
            if (edge < 1.3) return p.solid(ax, ay, RR.LIT, x - x0 < 1.3 || y1 - y < 1.3 ? 0.56 : 0.1);   // the housing's rim: lit facing the lamp
            if (inside(PANEL.screen, x, y)) {                    // the screen: dark glass, a faint reflection
                const e = Math.min(x - PANEL.screen[0], PANEL.screen[2] - x, y - PANEL.screen[1], PANEL.screen[3] - y);
                return p.solid(ax, ay, RR.GLASS, e < 0.6 ? 0.02 : 0.1 + (Math.abs((x - y * 0.6) % 9 - 3) < 0.7 ? 0.14 : 0));
            }
            for (let n = 0; n < LIGHTS; n++) { const b = lightBox(PANEL, n); if (inside(b, x, y)) return p.solid(ax, ay, RR.GLASS, x - b[0] < 0.6 ? 0.04 : 0.13); }   // the lights, dark
            if (inside(PANEL.lever, x, y)) {                      // the lever's slot
                const e = Math.min(x - PANEL.lever[0], PANEL.lever[2] - x, y - PANEL.lever[1], PANEL.lever[3] - y);
                return p.solid(ax, ay, RR.HULL, e < 0.6 ? (y - PANEL.lever[1] < 0.6 ? 0.02 : 0.38) : 0.06);
            }
            p.solid(ax, ay, RR.HULL, 0.27 + (M.vnoise(x * 1.3, y / 4, 131) - 0.5) * 0.06);
        });
        const lx = Math.round((PANEL.label[0] + 0.5) * d), ly = Math.round((PANEL.label[1] + 0.5) * d);
        M.pixelText('CYCLE', lx, ly, (gx, gy) => { if (M.hash(gx, gy, 132) > 0.12) p.solid(gx, gy, RR.PAINT, 0.6); });
    };
    /** The airlock behind the door: a short room, its inner door shut at the back, a strip light still on above it. */
    function airlockInside(p, d, RR) {
        const M = P(), BACK = 0.55, VP = K.VP, bw = BACK * HB.hw, bh = BACK * HB.hh, lampY = VP.y - bh + 2.2;
        K.eachArt(d, ...K.HATCH_BOX, (ax, ay, x, y) => {
            const dd = K.sdf(x, y);
            if (dd > 0.5) return;
            if (dd > -2.2) return p.solid(ax, ay, RR.HULL, (x - HB.cx) / HB.hw + (y - HB.cy) / HB.hh > 0.2 ? 0.16 : 0.42);   // the door frame: a clean edge
            const qx = Math.abs(x - VP.x) / HB.hw, qy = Math.abs(y - VP.y) / HB.hh, q = Math.max(qx, qy), ix = x - VP.x, iy = y - VP.y;
            const light = Math.exp(-Math.hypot(ix / (HB.hw * 0.85), (y - lampY) / (HB.hh * 0.6)));   // the strip light's glow on everything
            const warm = M.threshold(ax, ay) < 0.6 * light ? RR.LIT : RR.HULL;
            if (q <= BACK) {                                     // the back wall
                if (Math.abs(y - lampY) < 0.9 && Math.abs(ix) < bw * 0.66) return p.solid(ax, ay, RR.SUN, 0.92 - 0.25 * Math.abs(ix) / bw);   // the strip light, still on
                if (Math.abs(y - lampY) < 1.6 && Math.abs(ix) < bw * 0.7) return p.solid(ax, ay, RR.HULL, 0.05);   // its housing
                const door = Math.abs(ix) < bw * 0.6 && iy > -bh + 4.6 && iy < bh - 0.4;
                if (!door) return p.solid(ax, ay, warm, 0.08 + 0.3 * light);
                const e = Math.min(bw * 0.6 - Math.abs(ix), iy - (-bh + 4.6), bh - 0.4 - iy);   // the inner door, shut
                if (e < 0.7) return p.solid(ax, ay, RR.HULL, 0.03);
                if (Math.abs(iy - (-bh + 9.2)) < 1.5 && Math.abs(ix) < bw * 0.32) return p.solid(ax, ay, RR.GLASS, iy < -bh + 8.6 && ix < 0 ? 0.42 : 0.1);   // its window: dark, the light caught in it
                if (Math.abs(iy - 3) < 0.7 && Math.abs(ix) < bw * 0.24) return p.solid(ax, ay, RR.LIT, 0.6);   // its handle
                return p.solid(ax, ay, warm, 0.12 + 0.26 * light);
            }
            const ceiling = y < VP.y && qy > qx, floor = y > VP.y && qy > qx;   // the walls of the little room, lit from the back
            let v = 0.05 + 0.3 * light * (ceiling ? 0.55 : 1) + (floor ? 0.03 : 0);
            if (Math.abs(qx - qy) < 0.012) v += 0.07;            // its corners catch the light
            if (floor && (1 / q * 4) % 1 < 0.14) v += 0.05;      // the floor grating
            if (!floor && !ceiling && Math.abs((((q - BACK) / (1 - BACK)) * 3) % 1 - 0.5) < 0.035) v -= 0.04;   // the wall's panels
            p.solid(ax, ay, warm, v);
        });
    }

    /** The hull before any lamp finds it: the lit picture with most of its pixels gone to ink (the house dither), the sky and
        the far light's rim along the hull's edge left as they are. */
    function inTheDark(lit, d) {
        const cv = Object.assign(document.createElement('canvas'), { width: lit.width, height: lit.height }), g = cv.getContext('2d');
        g.drawImage(lit, 0, 0);
        const img = g.getImageData(0, 0, cv.width, cv.height), px = img.data;
        for (let ay = 0; ay < cv.height; ay++) for (let ax = 0; ax < cv.width; ax++) {
            const x = (ax + 0.5) / d - 0.5, y = (ay + 0.5) / d - 0.5;
            if (y < K.horizon(x) + 2.5 || MiniLab.bayer8(ax, ay) > 0.8) continue;
            const o = (ay * cv.width + ax) * 4;
            px[o] = 5; px[o + 1] = 7; px[o + 2] = 10;            // the ink
        }
        g.putImageData(img, 0, 0);
        return cv;
    }

    /** The pictures of this door, for Torch.js's paintScene: { paint, lampK, lamp, inside, more }. */
    function art(o) {
        if (o.door === 'frozen') return { paint: crackPainter(iceHolds(o.seed)), inside: icedInside };
        if (o.door === 'fuel') return { paint: pipePainter(fuelLine(o.seed)) };
        if (o.door === 'already') return { paint: oldCutPainter(o.seed), lamp: false, more: (s, d, lit) => ({ hullDark: inTheDark(lit, d) }) };   // no lamp of ours yet: the lander's lamp sweeps the hull
        const hanging = !!(window.TorchGround && window.TorchGround.is(o));   // on the ground
        if (o.door === 'torn') return { paint: (p, d, RR) => tearPainter(p, d, RR, hanging) };
        if (o.door === 'panel') return { paint: panelPainter(panelOf(o)), inside: airlockInside };
        return {};
    }

    // ── the three doors without the torch: a short picture and a line ──
    const SKIP_AFTER = 0.6, BEAT_FPS = 30, READ_MIN = 2.4;      // s: the click that opened the frame never skips it; frames a second; a line stays at least this long
    const readFor = words => clamp(1 + 0.22 * words.split(' ').length, READ_MIN, 3.6);
    const SCENES = {};

    function mountBeat(ctx, ui, setup) {
        const d = (ui.art && ui.art.d) || MiniLab.density || 1, { AW, AH } = K.sizeOf(d), cv = ui.canvas;
        const env = {
            setup, d, AW, AH, ctx, ui, R: K.ramps(), snd: K.makeSound(), pics: K.paintScene(setup, d),
            under: K.makeLayer(AW, AH), over: K.makeLayer(AW, AH), A: v => Math.floor((v + 0.5) * d), art: fn => MiniLab.inArt(ctx, fn),
            jaxId: idOf(setup.cutter) || 'jaxon', spotId: idOf(setup.spotter),
            ground: window.TorchGround && window.TorchGround.is(setup) ? window.TorchGround : null,   // on a planet's surface (TorchGround.js)
        };
        let clock = 0, ended = false, lastLine = -99, lineEnd = 0;
        const queue = [], shown = new Map();                     // lines still to say: [earliest, speaker, words]; the readouts on the picture now
        env.say = (at, who, words) => { queue.push([at, who, words]); queue.sort((a, b) => a[0] - b[0]); };
        env.note = (id, text, o = {}) => {                       // only touch the page when a readout changes
            const key = text == null ? null : [text, o.x, o.y, o.tone, o.align, o.size].join('|');
            if (shown.get(id) === key) return;
            shown.set(id, key); ui.note(id, text, o);
        };
        env.finish = () => {
            if (ended) return;
            ended = true;
            ui.finish({ opened: true, fuelLeft: 1, scars: 0, warps: 0, tanks: 1, bySelf: true, door: setup.door });
        };
        const make = SCENES[setup.door];
        make.lines(setup).forEach(([at, who, words]) => env.say(at, who, words));
        const scene = make(env);
        function frame(dt) {
            clock += dt;
            if (queue.length && clock >= queue[0][0] && clock - lastLine >= 1.6) {   // one line at a time
                const [, who, words] = queue.shift();
                ui.say(who, words); lastLine = clock; lineEnd = clock + readFor(words);
            }
            scene.update(dt, clock);
            ctx.setTransform(d, 0, 0, d, 0, 0);
            env.under.clear(); env.over.clear();
            scene.draw(clock);
            const end = scene.endsAt();
            if (end != null && clock >= Math.max(end, lineEnd) && !queue.length) env.finish();
        }
        const skip = () => { if (clock >= SKIP_AFTER && scene.canSkip()) env.finish(); };
        cv.style.cursor = 'pointer';
        cv.onpointerdown = e => {
            if (e.button > 0) return;
            if (!(scene.press && scene.press(true))) skip();
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers cannot be captured */ }
        };
        cv.onpointerup = cv.onpointercancel = () => { if (scene.press) scene.press(false); };
        MiniLab.onKey((k, e) => {
            const onButton = !!(e && e.target && e.target.tagName === 'BUTTON');
            if ((k === 'Enter' || k === 'Escape') && !onButton) skip();
            else if (k === ' ' && !onButton && !scene.press) skip();   // the panel reads a held Space itself
        });
        ui.clear();                                              // no empty speaker until the first line
        ui.buttons(scene.buttons ? scene.buttons() : [{ label: 'Go in', quiet: true, onClick: env.finish }]);
        MiniLab.loop(frame, BEAT_FPS);
        frame(0);
        return () => { env.snd.drop(); cv.style.cursor = ''; };
    }
    const idOf = who => (window.MiniCrew ? window.MiniCrew.idOf(who) : null);

    // people in the beats: drawn as Torch draws Jaxon, lit by our lamp (or the lander's); on the ground they stand
    function person(env, id, at, o = {}) {
        if (!window.MiniCrew || !id) return;
        const warm = clamp(1 - Math.hypot(at.x - K.LAMP.aimX, at.y - 30 - K.LAMP.aimY) / 200, 0, 1);
        window.MiniCrew.small(env.ctx, id, at.x, at.y, { h: o.h || K.JAX.H, pose: o.pose || (env.ground ? 'stand' : 'float'), facing: o.facing || 1, light: 1, warm: 0.25 + 0.5 * warm * (o.lit == null ? 1 : o.lit), dim: o.dim == null ? 0.25 : o.dim, t: o.t || 0 });
    }
    function tether(env, from, to, sag = 10) {                   // a slack line, as Torch draws Jaxon's (none on the ground)
        if (env.ground) return;
        const { under: L, d } = env, mx = (from.x + to.x) / 2, my = Math.max(from.y, to.y) + sag, n = Math.max(100, Math.ceil((Math.hypot(to.x - from.x, to.y - from.y) + 2 * sag) * d * 1.4));
        for (let k = 0; k <= n; k++) {
            const t = k / n, u = 1 - t;
            L.set((u * u * from.x + 2 * u * t * mx + t * t * to.x + 0.5) * d, (u * u * from.y + 2 * u * t * my + t * t * to.y + 0.5) * d, k % 6 < 3 ? C.hull[3] : C.hull[2]);
        }
    }
    const waist = (at, facing = 1) => ({ x: at.x - facing * 0.1 * K.JAX.H, y: at.y - 0.5 * K.JAX.H });
    const bobOf = (t, d, env) => (env && env.ground ? 0 : Math.round(Math.sin(Math.floor(t * 8) / 8 * 0.9) * 2 * d) / d);   // drifting on a line, eight steps a second; still on the ground
    function sparksOf(list, dt, env) {                           // on the ground they fall (TorchGround.fly)
        if (env && env.ground) return list.map(q => env.ground.fly(q, dt, env.setup)).filter(q => q.life > 0);
        return list.map(q => ({ ...q, x: q.x + q.vx * dt, y: q.y + q.vy * dt, life: q.life - dt })).filter(q => q.life > 0);
    }
    function drawSparks(env, list) {
        const { over: L, d } = env;
        list.forEach(q => {
            const x = (q.x + 0.5) * d, y = (q.y + 0.5) * d;
            if (q.dust) return L.set(x, y, q.life > 0.5 ? C.textDim : C.mist);
            if (q.ice) { L.line(x - q.vx * 0.03 * d, y - q.vy * 0.03 * d, x, y, C.uiDim); return L.set(x, y, q.life > 0.5 ? C.star : C.uiBright); }
            if (q.life > 0.2) L.line(x - q.vx * 0.025 * d, y - q.vy * 0.025 * d, x, y, C.warm);
            L.set(x, y, q.life > 0.3 ? C.warmBright : C.warm);
        });
    }
    const burst = (x, y, n, o = {}) => Array.from({ length: n }, () => {   // sparks (or ice) flying from a point
        const a = (o.dir == null ? Math.random() * Math.PI * 2 : o.dir + (Math.random() - 0.5) * (o.spread || 1.2)), v = (o.v || 40) * (0.4 + Math.random() * 0.8);
        return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: (o.life || 0.5) * (0.5 + Math.random()), ice: !!o.ice, dust: !!o.dust };
    });

    // ALREADY CUT: the lander's lamp finds the hatch; the loose door, cut long ago, tips out of its frame (on the ground Jaxon
    // walks in from the left, and the door tips back into the wreck and lands with the knock)
    SCENES.already = env => {
        const { setup, d, AW, AH, pics, art } = env, J = K.JAX, TG = env.ground;
        const SWEEP = [0.15, 1.5], OPEN_AT = 1.55, TIP = 1.9, END = 4.4, FALL = 1.3;   // FALL: on the ground it lands with the knock
        const lit = pixelsOf(pics.hullBg), dark = pixelsOf(pics.hullDark), img = new ImageData(AW, AH), f32 = new Uint32Array(img.data.buffer);
        const beamCv = Object.assign(document.createElement('canvas'), { width: AW, height: AH }), bg = beamCv.getContext('2d');
        const from = { x: 60, y: 300 }, to = { x: K.LAMP.aimX, y: K.LAMP.aimY };
        const arrive = TG ? { from: { x: 6, y: TG.standAt(6, setup) }, to: TG.jaxonAt(setup), at: [0.25, 2.3] } : { from: { x: 150, y: 352 }, to: J.IDLE, at: [0.25, 2.3] };
        let groaned = false, knocked = false, jax = { ...arrive.from }, walking = false, dust = [];
        function beam(t) {                                       // the lamp's pool: from low on the left up onto the hatch, widening, then everywhere
            const k = ease(clamp((t - SWEEP[0]) / (SWEEP[1] - SWEEP[0]), 0, 1));
            return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), r: lerp(55, 170, k) + 500 * Math.max(0, t - SWEEP[1]) };
        }
        function paintBeam(t) {
            const b = beam(t), cx = (b.x + 0.5) * d, cy = (b.y + 0.5) * d, r = b.r * d;
            for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
                const i = y * AW + x, q = Math.hypot(x - cx, (y - cy) * 1.15) / r;
                f32[i] = q < 1 && MiniLab.on(x, y, Math.min(1, (1 - q) * 2.4)) ? lit[i] : dark[i];
            }
            bg.putImageData(img, 0, 0);
        }
        function tipLid(g, t) {                                  // the loose door tips out at the top, towards us, and drifts down and away
            const k = clamp(t / TIP, 0, 1), th = 1.22 * (1 - (1 - k) ** 2.2) + 0.05 * Math.max(0, t - TIP), c = Math.cos(th), sn = Math.sin(th);
            const top = Math.floor((HB.cy - HB.hh - 2) * d), bot = Math.ceil((HB.cy + HB.hh + 2) * d), left = Math.floor((HB.cx - HB.hw - 2) * d);
            const w = Math.ceil((2 * HB.hw + 4) * d), cx = (HB.cx + 0.5) * d, dx = -(5 * t + 5 * t * t) * d, dy = (3 * t + 6 * t * t) * d;
            g.save(); g.imageSmoothingEnabled = false;
            for (let ay = bot; ay >= top; ay--) {                // bottom up, so the top (now nearer, and wider) is drawn last
                const v = bot - ay, sx = 1 + 0.38 * sn * v / (bot - top), y2 = Math.round(bot - v * c + dy), x2 = Math.round(cx - (cx - left) * sx + dx);
                g.drawImage(pics.lid, left, ay, w, 1, x2, y2, Math.round(w * sx), 2);
            }
            g.restore();
        }
        const SILL = [-30, -10, 10, 30].map(ox => ({ x: HB.cx + ox, y: HB.cy + HB.hh - 3 }));   // GROUND: where the fallen door throws dust up
        return {
            update(dt, t) {
                const k = ease(clamp((t - arrive.at[0]) / (arrive.at[1] - arrive.at[0]), 0, 1)), x = lerp(arrive.from.x, arrive.to.x, k);
                walking = !!TG && k > 0 && k < 1;
                jax = { x, y: TG ? TG.standAt(x, setup) : lerp(arrive.from.y, arrive.to.y, k) };
                if (t >= OPEN_AT && !groaned) { groaned = true; env.snd.groan(0.25); }
                if (t >= OPEN_AT + FALL && !knocked) {
                    knocked = true; env.snd.knock(0.5);
                    if (TG) dust = burst(HB.cx, HB.cy + HB.hh - 4, 24, { dir: -Math.PI / 2, spread: 2.4, v: TG.hasAir(setup) ? 22 : 34, life: 1.4, dust: true });   // the door hits the floor
                }
                dust = sparksOf(dust, dt, env);
            },
            draw(t) {
                art(g => { g.fillStyle = C.void; g.fillRect(0, 0, AW, AH); });
                if (t < SWEEP[1] + 0.5) { paintBeam(t); art(g => g.drawImage(beamCv, 0, 0)); } else art(g => g.drawImage(pics.hullBg, 0, 0));
                if (t >= OPEN_AT) art(g => { g.drawImage(pics.hole, 0, 0); if (TG) TG.drawLid(g, TG.lidAt((t - OPEN_AT) * TG.LAND / FALL), pics.lid, d); else tipLid(g, t - OPEN_AT); });
                const landT = t - OPEN_AT - FALL;
                if (TG && TG.hasAir(setup) && landT >= 0 && landT < 1.2) SILL.forEach(q => TG.puff(env.under, setup, q.x, q.y - 4 * landT, 1 - landT / 1.2, d, 3));
                const at = { x: jax.x, y: jax.y + bobOf(t, d, env) }, b = beam(t), lit = clamp(1 - Math.hypot(at.x - b.x, at.y - 30 - b.y) / b.r, 0, 1);
                tether(env, waist(at), { x: 168, y: 300 }, 6);     // their line goes back to the lander
                if (TG) TG.footShadow(env.under, at.x, at.y, d, 9);
                art(g => env.under.draw(g));
                person(env, env.jaxId, at, { lit, dim: 0.25 + 0.5 * (1 - lit), pose: walking ? 'walk' : undefined, t: t * 1600 });
                if (dust.length) { drawSparks(env, dust); art(g => env.over.draw(g)); }
            },
            endsAt: () => END,
            canSkip: () => true,
        };
    };
    function pixelsOf(canvas) {                                  // a copy of a canvas's pixels, one 32-bit word each
        const g = canvas.getContext('2d');
        return new Uint32Array(g.getImageData(0, 0, canvas.width, canvas.height).data.buffer.slice(0));
    }

    // TORN: no door to open; Jaxon floats over to the split and climbs in, the spotter after him. On the ground they walk to the
    // foot of the split (the spotter from the right, off the picture), scramble up and climb in
    SCENES.torn = env => {
        const { setup, d, pics, art, ctx } = env, T = tearShape(), J = K.JAX, TG = env.ground;
        const gapAt = y => ({ x: T.mid(y) - 1, y });
        const onSoil = x => ({ x, y: TG.standAt(x, setup) });
        const JAX = TG ? { from: TG.jaxonAt(setup), front: onSoil(T.mid(206) - 3), inside: { x: T.mid(198) + 5, y: 207 }, go: [0.5, 2.2], climb: [2.2, 3.1] }
            : { from: J.IDLE, front: { x: T.mid(150) - 1, y: 188 }, inside: { x: T.mid(140) + 5, y: 172 }, go: [0.5, 2.2], climb: [2.2, 3.1] };
        const SPOT = TG ? { from: onSoil(500), front: onSoil(T.mid(212) + 3), inside: { x: T.mid(204) + 4, y: 212 }, go: [1.5, 3.2], climb: [3.2, 4.0] }
            : { from: { x: 96, y: 345 }, front: { x: T.mid(160) - 2, y: 196 }, inside: { x: T.mid(150) + 4, y: 180 }, go: [1.5, 3.2], climb: [3.2, 4.0] };   // in after him, from off the picture
        const two = !!env.spotId && env.spotId !== env.jaxId, END = 4.4, IN_FROM = TG ? 0.45 : 0;   // GROUND: the first part of the climb is up to the split
        let grabbed = false;
        const clipToGap = g => {                                 // the split (on the ground with what is below it: legs still outside stay seen)
            g.beginPath(); T.outline.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, (x + 0.5) * d, (y + 0.5) * d)); g.closePath();
            if (TG) g.rect((T.mid(T.bot) - 40 + 0.5) * d, (T.bot - 10 + 0.5) * d, 80 * d, (K.H - T.bot + 12) * d);
            g.clip();
        };
        function placeOf(m, t) {                                 // floating (walking) over to the split, then climbing in
            if (t < m.go[0]) return { at: m.from, pose: TG ? 'stand' : 'float', inside: 0 };
            if (t < m.go[1]) {
                const k = ease((t - m.go[0]) / (m.go[1] - m.go[0])), x = lerp(m.from.x, m.front.x, k);
                if (TG) return { at: { x, y: TG.standAt(x, setup) }, pose: 'walk', inside: 0, facing: Math.sign(m.front.x - m.from.x) || 1 };
                return { at: { x: lerp(m.from.x, m.front.x, k), y: lerp(m.from.y, m.front.y, k) - 16 * Math.sin(Math.PI * k) }, pose: 'float', inside: 0 };
            }
            const k = clamp((t - m.climb[0]) / (m.climb[1] - m.climb[0]), 0, 1);
            return { at: { x: lerp(m.front.x, m.inside.x, k), y: lerp(m.front.y, m.inside.y, k) }, pose: 'climb', inside: clamp((k - IN_FROM) / (1 - IN_FROM), 0, 1), climbing: k > 0 };
        }
        function draw(id, m, t) {
            const pl = placeOf(m, t);
            if (pl.inside >= 1) return;
            const bob = pl.pose === 'float' && t < m.go[0] ? bobOf(t, d, env) : 0, at = { x: pl.at.x, y: pl.at.y + bob };
            if (pl.inside <= 0) return person(env, id, at, { pose: pl.pose, facing: pl.facing, t: t * (TG && pl.pose === 'walk' ? 1700 : 1000) });
            ctx.save(); art(clipToGap);                          // going in: what passes behind the plating is hidden; they go dark
            person(env, id, at, { pose: 'climb', t: t * 1000, h: K.JAX.H * (1 - 0.12 * pl.inside), dim: 0.25 + 0.75 * pl.inside, lit: 1 - pl.inside });
            ctx.restore();
        }
        return {
            update(dt, t) { if (t >= JAX.climb[0] && !grabbed) { grabbed = true; env.snd.knock(0.4); } },
            draw(t) {
                art(g => g.drawImage(pics.hullBg, 0, 0));
                const pj = placeOf(JAX, t), lip = gapAt(150);    // Jaxon's line: to him, or to the edge of the split once he is in
                tether(env, pj.inside > 0.5 ? { x: T.left(150), y: lip.y } : waist(pj.at), { x: K.LAMP.x - 3, y: K.LAMP.y + 5 });
                if (TG) { [[JAX, env.jaxId], two ? [SPOT, env.spotId] : null].filter(Boolean).forEach(([m]) => { const pl = placeOf(m, t); if (!pl.climbing) TG.footShadow(env.under, pl.at.x, pl.at.y, d, 9); }); }
                art(g => env.under.draw(g));
                if (two) draw(env.spotId, SPOT, t);
                draw(env.jaxId, JAX, t);
            },
            endsAt: () => END,
            canSkip: () => true,
        };
    };
    SCENES.torn.lines = setup => [[0.45, setup.cutter, 'No need for the torch. We go in through the side.']];

    // LIVE PANEL: the cutter wires the airlock's panel; the player holds the switch while it cycles; the door slides open.
    // On the ground the panel is lower on the hull, and Jaxon walks over to it on the soil
    SCENES.panel = env => {
        const { setup, d, AW, pics, art, ui, ctx, A } = env, J = K.JAX, TG = env.ground, PANEL = panelOf(setup);
        const hands = { x: PANEL.lever[0] + 2.5, y: PANEL.lever[1] + 5 }, at = { x: hands.x - 0.33 * J.H, y: hands.y + 0.7 * J.H };
        const GO = [0.35, 1.5], WIRED = 1.6, OFFER = 1.9, CYCLE_S = 2, DRAIN_S = 3, UNLOCK = 0.45, SLIDE = 1.6, AFTER = 2.4;
        const home = TG ? TG.jaxonAt(setup) : J.IDLE;
        let jax = { ...home }, wired = false, offered = false, held = false, charge = 0, cycledAt = null, slid = false, sparks = [], hintT = 0;
        const port = { x: PANEL.port[0], y: PANEL.port[1] };
        const opening = t => (cycledAt === null ? 0 : ease(clamp((t - cycledAt - UNLOCK) / SLIDE, 0, 1)));
        function slideLid(g, k) {                                // the door runs sideways into the hull, behind the frame
            const x = (HB.cx - HB.hw + 0.5) * d, y = (HB.cy - HB.hh + 0.5) * d, w = 2 * HB.hw * d, h = 2 * HB.hh * d;
            g.save(); g.beginPath();
            if (g.roundRect) g.roundRect(x, y, w, h, HB.r * d); else g.rect(x, y, w, h);
            g.clip();
            g.drawImage(pics.lid, Math.round(k * (2 * HB.hw + 4) * d), 0);
            g.restore();
        }
        function cycle(t) {
            cycledAt = t; held = false;
            env.snd.hum(0); env.snd.clunk();
            ui.buttons([{ label: 'Go in', quiet: true, onClick: env.finish }]);
            env.note('cycle', null);
            env.say(t + UNLOCK + 0.9, setup.spotter, "There's still a light on inside.");
        }
        function drawPanel(t) {                                  // the screen awake, the lights climbing with the charge, the lever going down
            const L = env.under, flick = !reduced() && t < WIRED + 0.5 && Math.floor(t * 14) % 3 === 0;
            if (wired && !flick) {
                const [x0, y0, x1, y1] = PANEL.screen;
                for (let ay = A(y0 + 0.8); ay <= A(y1 - 0.8); ay++) for (let ax = A(x0 + 0.8); ax <= A(x1 - 0.8); ax++) if (MiniLab.on(ax, ay, 0.28)) L.set(ax, ay, C.hurt[2]);
                [[0, 9], [1, 6], [2, cycledAt === null ? Math.round(2 + 7 * charge) : 9]].forEach(([row, len]) => {   // three lines of words, too small to read; the last fills as it cycles
                    for (let k = 0; k < len; k++) L.set(A(x0 + 1.4) + k, A(y0 + 1.6 + row * 1.9), C.warm);
                });
            }
            const lit = !wired ? 0 : cycledAt !== null ? LIGHTS : Math.max(1, Math.ceil(charge * LIGHTS - 0.001));
            const flash = cycledAt !== null && !reduced() && t - cycledAt < 0.5 && Math.floor((t - cycledAt) * 8) % 2;
            for (let n = 0; n < lit; n++) {
                const [x0, y0, x1, y1] = lightBox(PANEL, n);
                for (let ay = A(y0); ay <= A(y1); ay++) for (let ax = A(x0) + 1; ax <= A(x1); ax++) L.set(ax, ay, flash ? C.star : ay === A(y0) ? C.warmBright : C.warm);
            }
            const ly = PANEL.lever[1] + 2 + (cycledAt !== null ? 1 : charge) * 9;   // the lever's handle
            for (let ax = A(PANEL.lever[0] + 0.8); ax <= A(PANEL.lever[2] - 0.8); ax++) { L.set(ax, A(ly), C.hull[4]); L.set(ax, A(ly) + 1, C.hull[2]); }
        }
        function drawCable() {                                   // from his pack to the panel's port, a clip at the end
            const pack = { x: jax.x - 0.13 * J.H, y: jax.y - 0.6 * J.H }, L = env.under, mx = (pack.x + port.x) / 2, my = Math.max(pack.y, port.y) + 8;
            for (let t = 0; t <= 1; t += 0.008) {
                const u = 1 - t, x = (u * u * pack.x + 2 * u * t * mx + t * t * port.x + 0.5) * d, y = (u * u * pack.y + 2 * u * t * my + t * t * port.y + 0.5) * d;
                L.set(x, y, C.hull[1]); L.set(x, y - 1, C.hull[3]);
            }
            L.set(A(port.x), A(port.y), C.warm); L.set(A(port.x) + 1, A(port.y), C.warm);
        }
        function spill(k) {                                      // the airlock's light falls out onto the hull below the sill, a soft pool
            const L = env.under, cx = HB.cx + 2, cy = HB.cy + HB.hh + 1, rx = HB.hw * 0.95, ry = 11;
            for (let ay = A(cy); ay <= A(cy + ry); ay++) for (let ax = A(cx - rx); ax <= A(cx + rx); ax++) {
                const q = Math.hypot((ax / d - cx) / rx, (ay / d - cy) / ry), v = 0.16 * k * (1 - q) * (1 - q);
                if (q < 1 && MiniLab.on(ax, ay, v)) L.set(ax, ay, C.warm);
            }
        }
        return {
            buttons: () => [],
            press(down) {
                if (!offered || cycledAt !== null) return false;
                held = down;
                return true;
            },
            update(dt, t) {
                const k = ease(clamp((t - GO[0]) / (GO[1] - GO[0]), 0, 1)), x = lerp(home.x, at.x, k);
                jax = TG ? { x, y: lerp(home.y, at.y, k) } : { x, y: lerp(J.IDLE.y, at.y, k) - 10 * Math.sin(Math.PI * k) };   // on the ground he walks over
                sparks = sparksOf(sparks, dt, env);
                if (t >= WIRED && !wired) { wired = true; sparks = sparks.concat(burst(port.x, port.y, 14, { v: 30, life: 0.45 })); env.snd.knock(0.3); }
                if (t >= OFFER && !offered) {
                    offered = true;
                    ui.buttons([{ label: 'Hold it', hold: true, primary: true, onDown: () => { held = true; }, onUp: () => { held = false; } }]);
                }
                if (offered && cycledAt === null) {
                    const holding = held || MiniLab.keys.has(' ');
                    charge = clamp(charge + (holding ? dt / CYCLE_S : -dt / DRAIN_S), 0, 1);
                    env.snd.hum(holding ? 0.3 + 0.7 * charge : 0);
                    hintT = holding ? 0 : hintT + dt;
                    if (charge >= 1) cycle(t);
                }
                if (cycledAt !== null && !slid && t >= cycledAt + UNLOCK) {
                    slid = true; env.snd.slide(SLIDE); env.snd.puff();
                    const dusty = !!TG && TG.hasAir(setup);                   // on a world with air: a breath of dust, not ice
                    sparks = sparks.concat(burst(HB.cx - HB.hw + 2, HB.cy, 26, { ice: !dusty, dust: dusty, dir: Math.PI, spread: 1.6, v: dusty ? 18 : 26, life: dusty ? 1.3 : 0.9 }));   // the last air out of the gap
                }
            },
            draw(t) {
                const k = opening(t);
                art(g => g.drawImage(pics.hullBg, 0, 0));
                if (k > 0) art(g => { g.drawImage(pics.hole, 0, 0); slideLid(g, k); });
                drawPanel(t);
                if (k > 0) spill(k);
                if (wired) drawCable();
                const bob = t < GO[0] ? bobOf(t, d, env) : 0, me = { x: jax.x, y: jax.y + bob };
                tether(env, waist(me), { x: K.LAMP.x - 3, y: K.LAMP.y + 5 });
                if (TG) TG.footShadow(env.under, me.x, me.y, d, 9);
                art(g => env.under.draw(g));
                const moving = !!TG && t > GO[0] && t < GO[1] - 0.2;
                person(env, env.jaxId, me, { pose: t >= GO[1] - 0.2 ? 'reach' : moving ? 'walk' : TG ? 'stand' : 'float', t: t * 1000 });
                drawSparks(env, sparks); art(g => env.over.draw(g));
                if (offered && cycledAt === null) {              // how far it has cycled; a nudge if nobody holds the switch
                    env.note('cycle', 'CYCLE ' + Math.round(charge * 100) + '%', { x: 8, y: K.H - 8 - 13 * 1.3 * (K.W / (ui.canvas.getBoundingClientRect().width || 960)), tone: charge > 0 ? 'ui' : 'text' });
                    env.note('hold', hintT > 1.2 && charge < 0.05 ? 'PRESS AND HOLD' : null, { x: PANEL.box[0] - 4, y: PANEL.box[1] - 14, align: 'right', tone: 'ui', size: 'm' });   // over the panel, where it is
                } else env.note('hold', null);
            },
            endsAt: () => (cycledAt === null ? null : cycledAt + UNLOCK + SLIDE + AFTER - 1.4),
            canSkip: () => cycledAt !== null,                    // until the door opens, a press is on the switch
        };
    };
    SCENES.panel.lines = setup => [[0.45, setup.cutter, 'The airlock still has a little power. Hold the switch while it cycles.']];
    SCENES.already.lines = setup => [[1.7, setup.spotter, 'Somebody cut this open before us.']];

    window.TorchDoors = Object.freeze({
        KINDS, PLAYED, BEATS, isBeat,
        has: k => KINDS.includes(k), pick, geometry, art, mountBeat,
    });
})();
