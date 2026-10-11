/* ═══ Silent Exodus · new screen (?new=1) · stop/Dive.js: the dive onto the bridge and back out ═════════════════════════
   What it is: arriving at a world, the view pushes on our own Lander (seen from outside, where the travel view drew it),
   turns it nose-up and goes in until its plating fills the screen, then inside the airlock's ring, where the bridge
   dissolves in (Stop.js). Leaving orbit plays it backwards. Eight steps: five of the hull growing and turning (they depend
   on where our ship was), three of the plating (painted once per screen size). Also the idle bake queue the stop's
   pictures share: a big picture is painted a band at a time in idle frames, finished at once if it is needed now.
   Source: prototypes/slice/stop.js §1 (stepGeom, platingStep, diveStep, bakeBigSteps, prepare) and its bake queue,
   unchanged but for reading NewScreen.G and NewScreen.mods (docs/BUILD_B.md §2). Recipes: art/Paint.js (hull + shapeL).
   No randomness. Loaded only when the new-screen switch is on.

   window.NSDive (frozen)
     STEPS, PUSH, DISSOLVE                       8 steps; the push takes 1000 ms; the Bayer dissolve 600 ms
     pic(w, h, bands) → { canvas, g, jobs }      a picture painted by a list of jobs;  ready(p) → p, every job done now
     later(p) → p   bake(budgetMs)   first(p)    queue it for idle frames; bake some; queue it ahead of everything
     banded(w, h, y0, y1, fn)                    jobs that paint rows y0..y1 a band at a time (fn(painter, oy))
     resize(G)                                   the plating steps for this screen size (queued, not painted yet)
     prepare()                                   a course is set: bake the plating steps in the flight's idle frames
     start(dir, pose, t) → dive                  dir 'in' | 'out'; pose { x, y, len, angle } art px (travel's landerPose)
     stepAt(dive, el) → 0..7                     which step shows el ms after the dive began
     draw(ctx, dive, t)                          one frame of the dive into canvas#ns-dive (G.W x G.H art px)
*/
(function () {
    'use strict';
    const NS = window.NewScreen, P = window.NSPaint;
    if (!NS || !NS.on || !P) return;
    const { RP, smooth, lerp, clamp01, hash } = P;
    const STEPS = 8, PUSH = 1000, DISSOLVE = 600;
    const UF = 0.42, BAND = 16;                                           // the hull point the push centres on; bake band (a multiple of 8)
    const BIG = 5;                                                        // steps 5..7 are the plating, the same wherever our ship was

    // ── baking: a picture painted in bands, a few per idle frame, finished at once if it is needed now ──
    const queue = [];
    function pic(w, h, bands) {
        const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
        const g = c.getContext('2d');
        return { canvas: c, g, jobs: bands.map(fn => () => fn(g)), x: 0, y: 0 };
    }
    function run(p) { const job = p.jobs.shift(); try { job(); } catch (err) { console.error('NewScreen stop: a bake failed', err); } }
    function ready(p) { while (p.jobs.length) run(p); return p; }
    function later(p) { if (p.jobs.length && !queue.includes(p)) queue.push(p); return p; }
    function first(p) { const i = queue.indexOf(p); if (i >= 0) queue.splice(i, 1); if (p.jobs.length) queue.unshift(p); return p; }
    function bake(budget) {
        const end = performance.now() + budget;
        while (queue.length && performance.now() < end) { const p = queue[0]; if (!p.jobs.length) { queue.shift(); continue; } run(p); }
    }
    /** Band jobs for a w x h picture: fn(painter, oy) paints into a w x BAND clear painter whose row 0 is picture row oy. */
    function banded(w, h, y0, y1, fn) {
        const out = [];
        for (let oy = Math.max(0, Math.floor(y0 / BAND) * BAND); oy < Math.min(h, y1); oy += BAND) {
            out.push(g => { const p = P.painter(w, BAND, false); fn(p, oy); g.putImageData(new ImageData(p.data, p.W, p.H), 0, oy); });
        }
        return out;
    }

    // ── 1. the hull pushed on, turned nose-up (NSPaint.hull + shapeL) ──
    const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
    function stepGeom(k, pose) {
        const G = NS.G, s = k / (STEPS - 1), big = k >= BIG, a = big ? 1 : smooth(0, 0.72, s);
        const lenEnd = Math.ceil(3.15 * 1.18 * Math.max(G.W, G.H * 1.2)), len0 = big ? Math.round(0.085 * G.H) : pose.len;
        const len = Math.exp(lerp(Math.log(Math.max(8, len0)), Math.log(lenEnd), Math.pow(s, 1.25)));
        const fx = pose.x + (0.5 - UF) * pose.len * Math.cos(pose.angle), fy = pose.y + (0.5 - UF) * pose.len * Math.sin(pose.angle);
        const hull = Math.max(0, Math.min(G.W * 0.5, G.hull || 0));
        const cx = big ? G.W / 2 : hull + (G.W - hull) / 2;              // the small steps turn in the middle of the space side, clear of the tower
        return { x: lerp(fx, cx, a), y: lerp(fy, G.H / 2, a), len, ht: len / 3.15, angle: lerpAngle(pose.angle, -Math.PI / 2, a), flip: true, seed: 9, anchor: UF,
            sun: len < 300 ? 0.24 : 0, sunDir: [0.94, -0.34], fade: len < 300 ? 0.22 : 0.08, flat: len < 130 };
    }
    const atOf = o => (u, v) => { const a = -(u - o.anchor) * o.len, b = v * o.ht, c = Math.cos(o.angle), s = Math.sin(o.angle); return [o.x + a * c - b * s, o.y + a * s + b * c]; };

    /** The dive's last three steps: our own hull fills the screen, dark plating lit from the light's side, rows of plates whose
        seams do not line up, rivets, a doubler plate round the airlock with its lit port, the corners going dark; each step
        pushes in on the port, and the last is inside its ring, where the bridge dissolves in. Unit: the 360-row stage's pixel. */
    const PLATE = { zoom: [1, 3.1, 11], PH: 44, PW: 66, RO: 15, RI: 11, DOUBLER: 25, SEAM: 0.9 };
    function seamDist(hx, hy) {                                          // → the nearest seam, which side, plate id
        const ph = PLATE.PH, pw = PLATE.PW;
        const ry = Math.floor((hy + ph * 0.37) / ph), y0 = ry * ph - ph * 0.37, dy0 = hy - y0, dy1 = y0 + ph - hy;
        const shift = hash(ry & 255, 3, 41) * pw, hxs = hx + shift, c0 = Math.floor(hxs / pw), edge = n => n * pw + (hash(n & 255, ry & 255, 43) - 0.5) * pw * 0.5;
        const c = hxs < edge(c0) ? c0 - 1 : hxs >= edge(c0 + 1) ? c0 + 1 : c0, dx0 = hxs - edge(c), dx1 = edge(c + 1) - hxs;
        return { d: Math.min(dx0, dx1, dy0, dy1), horiz: Math.min(dy0, dy1) <= Math.min(dx0, dx1), below: dy0 < dy1, right: dx0 < dx1, id: ((c & 255) * 31 + (ry & 255)) & 255, ry, dy0, dx0, dx1 };
    }
    function platePx(k, hx, hy, vig) {                                   // → [ramp, v] for one pixel of the plating
        const d = Math.hypot(hx, hy);
        if (d < PLATE.RI) {                                              // the port: warm light inside, brightest at its middle
            const g = 1 - d / PLATE.RI, v = (k === 7 ? 0.2 : 0.3) * Math.pow(g, 0.6) + 0.06 * (P.fbm(hx / 3, hy / 3, 77, 2) - 0.5);
            return [RP.AMBER, v * (k === 7 ? 1 : vig)];
        }
        const lit = clamp01(0.5 + 0.42 * (hx * 0.94 - hy * 0.34) / 140);  // across the hull toward the light (right and a little up)
        if (d < PLATE.RO) {                                              // the ring: steel, lit on the light's side, eight bolts
            const a = Math.atan2(hy, hx), face = 0.5 + 0.5 * Math.cos(a + 0.35), bolt = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) < 0.09 && d > PLATE.RI + 1.2 && d < PLATE.RO - 1.2;
            return [RP.HULL, ((d < PLATE.RI + 0.8 ? 0.06 : 0.2 + 0.28 * face) + (bolt ? 0.16 : 0)) * vig];
        }
        const sd = seamDist(hx, hy), plateV = (hash(sd.id, 7, 45) - 0.5) * 0.07 + (hash(sd.id, 9, 47) > 0.86 ? -0.05 : 0);
        let v = 0.11 + 0.17 * lit + plateV + 0.07 * (P.fbm(hx / 18, hy / 9, 49, 3) - 0.5) + 0.04 * (P.fbm(hx / 2.5, hy / 2.5, 51, 2) - 0.5);
        const seam = PLATE.SEAM, db = Math.abs(d - PLATE.DOUBLER);
        if (db < seam) v = 0.035;                                        // the doubler plate round the airlock
        else if (d < PLATE.DOUBLER) v += 0.04 + (db < seam * 2.2 && hy > -hx * 0.4 ? 0.06 : 0);
        else if (sd.d < seam) v = 0.03;                                  // a seam
        else if (sd.d < seam * 2.4) v += (sd.horiz ? (sd.below ? 0.07 : -0.03) : (sd.right ? 0.05 : -0.025));   // its lit lip, toward the light
        if (sd.horiz && d > PLATE.DOUBLER + 2 && sd.below) {             // rivets along the horizontal seams
            const ry = sd.dy0, rx = ((hx + hash(sd.ry & 255, 5, 53) * 6) % 6 + 6) % 6;
            if (Math.abs(ry - 2.6) < 0.75 && Math.abs(rx - 3) < 0.75) v = (ry < 2.6 || rx > 3) ? 0.42 : 0.05;
        }
        if (Math.hypot(Math.abs(hx) - 19.5, hy) < 0.9 && d < PLATE.DOUBLER) v = 0.36;   // two small bolts in the doubler, either side
        return [RP.HULL, Math.max(0.02, v) * vig];
    }
    function platingStep(k) {
        const G = NS.G, u = G.H / 360, z = PLATE.zoom[k - BIG], PX = G.W * 0.56, PY = G.H * 0.47, s = u * z;
        return pic(G.W, G.H, banded(G.W, G.H, 0, G.H, (bp, oy) => bp.region(0, 0, G.W, BAND, (x, y) => {
            const Y = y + oy, hx = (x + 0.5 - PX) / s, hy = (Y + 0.5 - PY) / s;
            const ed = Math.max(Math.abs(x / G.W - 0.5), Math.abs(Y / G.H - 0.5)) * 2, vig = 1 - 0.62 * smooth(0.5, 1.02, ed);
            const [ramp, v] = platePx(k, hx, hy, vig);
            bp.solid(x, y, ramp, v);
        })));
    }
    function diveStep(k, pose) {
        if (k >= BIG) { const p = platingStep(k); p.len = Infinity; p.ports = null; return p; }
        const G = NS.G, o = stepGeom(k, pose), at = atOf(o);
        const pts = [[0, -0.9], [0, 0.9], [1, -0.9], [1, 0.9]].map(([u, v]) => at(u, v)), ys = pts.map(q => q[1]);
        const p = pic(G.W, G.H, banded(G.W, G.H, Math.min(...ys) - 4, Math.max(...ys) + 4, (bp, oy) => P.hull(bp, Object.assign({}, o, { y: o.y - oy }), P.shapeL)));
        p.len = o.len; p.ports = o.len < 300 ? [0, 1, 2, 3, 4, 5].map(i => at(P.DECK_U(i) + 0.054, -0.32)) : null;
        p.port = Math.max(1, Math.round(o.len / 60));
        return p;
    }
    let bigSteps = [];
    /** The last three steps do not depend on where our ship was: made per screen size, painted when a course is set. */
    function resize(G) {
        if (!G || !G.W) return;
        for (let i = queue.length - 1; i >= 0; i--) if (bigSteps.includes(queue[i])) queue.splice(i, 1);
        const pose = { x: G.W / 2, y: G.H / 2, len: Math.round(0.085 * G.H), angle: 0 };
        bigSteps = [5, 6, 7].map(k => diveStep(k, pose));
    }
    function prepare() { bigSteps.forEach(later); }
    function start(dir, pose0, t) {
        const G = NS.G, pose = pose0 && pose0.len ? pose0 : { x: G.W * 0.6, y: G.H * 0.6, len: 46, angle: -0.3 };
        if (!bigSteps.length) resize(G);
        const steps = [0, 1, 2, 3, 4].map(k => diveStep(k, pose));
        steps.slice().reverse().forEach(first);
        bigSteps.forEach(later);
        return { dir, t0: t, pose, steps, plated: false, done: false, open: false };
    }
    /** In: the push (8 steps over PUSH ms), then held on the port. Out: held for the dissolve, then the steps back. */
    function stepAt(d, el) {
        if (d.dir === 'in') return el < PUSH ? Math.min(STEPS - 1, Math.floor(el / (PUSH / STEPS))) : STEPS - 1;
        return el < DISSOLVE ? STEPS - 1 : Math.max(0, STEPS - 1 - Math.floor((el - DISSOLVE) / (PUSH / STEPS)));
    }
    function draw(ctx, d, t) {
        const G = NS.G, k = stepAt(d, t - d.t0), p = ready(k >= BIG ? bigSteps[k - BIG] : d.steps[k]);   // the plating at this size (a resize mid-dive)
        ctx.clearRect(0, 0, G.W, G.H);
        ctx.drawImage(p.canvas, 0, 0);
        if (p.ports) {                                                   // the decks lit from inside, as the travel view draws them
            const tw = NS.mods.tower;
            let occ = [], beat = 0.6;
            try { occ = (tw && tw.occupied ? tw.occupied() : []) || []; beat = tw && tw.beat ? tw.beat(t) : 0.6; } catch (err) { occ = []; }
            const f = P.framer(ctx, G.W, G.H);
            p.ports.forEach(([x, y], i) => { if (occ[i]) f.px(x - (p.port >> 1), y - (p.port >> 1), RP.AMBER.hex[beat > 0.5 ? 4 : 3], p.port, p.port); });
        }
        return k;
    }

    window.NSDive = Object.freeze({ STEPS, PUSH, DISSOLVE, pic, ready, later, first, bake, banded, resize, prepare, start, stepAt, draw, pending: () => queue.length });
})();
