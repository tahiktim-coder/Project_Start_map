/* ═══ Silent Exodus · new screen (?new=1) · throw/SeaArt.js: the pictures of the sea of ships ════════════════════════════
   What it is: the film the jump into sector 3 ends on (throw/SeaFilm.js plays it), painted with NSPaint. Our Lander, dark and
   cold, one red lamp on its hull; as if our eyes adjust, we see we are in a graveyard: wrecks of our own class all round us,
   snapped in two, torn open to the frame, burnt black, plates peeled back, loose plating and girders drifting between them, a
   few with a dead red beacon, every one still pointing at the far light. The camera pulls back, and back, and back, until our
   ship is one red dot in a sea of thousands of wrecks, all on the same heading. Then the drive relights, white.
   Source: prototypes/films/sea.html (its camera, its graveyard, paintWreck, the far field, our ship, the red lamp, the
   streaks), ported with V3Paint replaced by NSPaint (art/Paint.js, the same recipes). The stall itself (the stars shrinking
   back, the drive coughing out, the decks going dark) is now played on the travel view (throw/Stall.js), so this film opens
   on our ship already dark and starts where the prototype's eyes adjust; its one line is gone (the narration is TheThrow's).
   No URL switches. The graveyard (about 100,000 hulls) and the far field are worked out in jobs (one a frame, while the
   stall plays), and the nearest wrecks baked at their first sizes, so the film never stalls when it starts.
   Loaded only when the new-screen switch is on, after art/Paint.js.

   window.NSSeaArt (frozen)
     AW, AH                  640 x 360 art px
     TL, DUR                 the timeline (ms); DUR the film's length
     create() → art          one film's pictures: art.jobs (() => void, run one a frame; run them all before the first frame
                             that shows the sea), art.ready() → bool, art.draw(ctx, T, still) the frame at T (ms), on a 640 x 360
                             canvas; still: reduced motion (the lamps steady, no white flash: a slow fade to ink)
     state(art) → { built, cached }   for the headless runs
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!window.NEW_SCREEN || !P) return;
    const { INK, RP, ramp, clamp01, smooth, lerp, hash, vnoise, fbm, seeded, threshold, LANDER, DECK_U } = P;
    const AW = 640, AH = 360, TICK = 125;
    const ease = k => k * k * (3 - 2 * k);
    const step8 = t => Math.floor(t / TICK) * TICK;

    // ═══ the timeline (ms) ═══
    const TL = Object.freeze({
        in: 900,                   // in from ink: our ship, dark, its red lamp
        reveal: [1700, 6600],      // the wrecks round us come out of the dark
        pull: [[6800, 12900, 3.7, 24], [13500, 19800, 24, 110], [20400, 27400, 110, 270]],   // three pulls back: [t0, t1, from, to] (ship lengths)
        relight: 28700, white: [30700, 31100], end: 31700,
    });
    const DUR = TL.end;

    // ═══ the camera: one pinhole, looking straight ahead; our ship stays at OUR on screen (in the middle of it all), the light at VP ═══
    const F = 560, C0 = [320, 180], VP = [560, 72], OUR = [296, 212], D0 = 3.7;
    const norm = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const madd = (a, ...terms) => terms.reduce((acc, [k, v]) => acc.map((x, i) => x + k * v[i]), a.slice());
    const HEAD = norm([(VP[0] - C0[0]) / F, (VP[1] - C0[1]) / F, 1]);        // the heading: toward the light
    const NRM = norm(cross([1, 0, 0], HEAD)), SIDE = norm(cross(HEAD, NRM));  // the sea's up, and across the heading
    const CAMDIR = [(OUR[0] - C0[0]) / F, (OUR[1] - C0[1]) / F, 1];
    // Every hull is drawn on ONE screen heading (ours, toward the light), with only a hint of perspective: true perspective
    // fanned them out from the light like a burst, and the point of the shot is that they are all going the same way.
    const HEAD_ANG = Math.atan2(VP[1] - OUR[1], VP[0] - OUR[0]);
    function headingAt(x, y, yaw) {
        let da = Math.atan2(VP[1] - y, VP[0] - x) - HEAD_ANG;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        return HEAD_ANG + Math.max(-0.8, Math.min(0.8, da)) * 0.18 + yaw * 0.5;
    }
    function distAt(t) {
        let D = TL.pull[0][2];
        for (const [t0, t1, a, b] of TL.pull) { if (t >= t1) D = b; else if (t > t0) { D = Math.exp(lerp(Math.log(a), Math.log(b), ease((t - t0) / (t1 - t0)))); break; } }
        return D;
    }
    const LEN_K = 0.92;          // a hull's length on screen is F / z times this (drawn side on, pointing at the light)
    function project(p, D) {
        const rx = p[0] + D * CAMDIR[0], ry = p[1] + D * CAMDIR[1], rz = p[2] + D * CAMDIR[2];
        if (rz < 0.4) return null;
        const n = Math.hypot(rx, ry, rz), along = (rx * HEAD[0] + ry * HEAD[1] + rz * HEAD[2]) / n, side = Math.sqrt(Math.max(0, 1 - along * along));
        return { x: C0[0] + F * rx / rz, y: C0[1] + F * ry / rz, len: F / rz * LEN_K * (0.45 + 0.55 * Math.min(1, side / 0.6)), z: rz };   // seen nose-on, a hull looks shorter
    }
    /** Where to put a thing so that at the first look (D0) its centre is at screen x, y and a whole hull there is `len` pixels long. */
    function placeOnScreen(x, y, len) {
        let z = F * LEN_K / len, p = null;
        for (let i = 0; i < 6; i++) {
            p = [(x - C0[0]) * z / F - D0 * CAMDIR[0], (y - C0[1]) * z / F - D0 * CAMDIR[1], z - D0 * CAMDIR[2]];
            const pr = project(p, D0); z *= pr.len / len;
        }
        return p;
    }

    // ═══ the wrecks ═══
    // Ramps: our hull ramp gone cold and grey; charred black; the old rust; the grey of a world we passed. No bright red: they
    // must read as Landers, ours, dead. FAR is what a wreck is when it is two or three pixels: dim cold metal, never a spark.
    const DEAD = ramp(INK, '#0f1417', '#1b252a', '#2f3d43', '#55666c', '#8e9fa4');
    const BURNT = ramp(INK, '#09090a', '#131416', '#1d2023', '#2a2f33', '#3f4549');   // charcoal: soot, not rust
    const FAR = ramp(INK, '#0f1418', '#182126', '#253238', '#384952', '#566a72');
    const RAMPS = [DEAD, DEAD, RP.PASSED, BURNT, DEAD, RP.RUST, DEAD, BURNT];   // mostly our own grey; a little old rust
    /** The damage a wreck carries, from its seed: torn (the threshold for holes, lower is worse), burn, plates gone, a beacon. */
    function dmgFor(seed) { const h = k => hash(seed, k, 41); return { torn: 0.56 + h(1) * 0.1, burn: 0.2 + h(2) * 0.75, plates: 0.08 + h(3) * 0.26, beacon: h(4) < 0.14 }; }

    // The graveyard round us at the first look, placed on screen: [x, y] is the centre of the piece, len the length a whole
    // hull at that depth would be, from/to the piece of the hull that is left (0 nose .. 1 bell). Each broken hull's other
    // half drifts nearby. Nothing covers us or the light.
    const NEAR = [
        { x: 72, y: 322, len: 300, from: 0, to: 0.47, yaw: 0.04, roll: 0.05, torn: 0.615, burn: 0.7, plates: 0.22 },        // the front half of a ship, close below-left
        { x: 14, y: 236, len: 250, from: 0.53, to: 1, yaw: -0.1, roll: -0.62, torn: 0.62, burn: 0.95, plates: 0.16 },       // its engine half, tumbling away
        { x: 122, y: 92, len: 132, from: 0, to: 1, yaw: 0.05, torn: 0.565, burn: 0.45, plates: 0.22, beacon: 2 },          // gutted down its side
        { x: 486, y: 262, len: 122, from: 0.3, to: 1, yaw: -0.04, roll: 0.14, ri: 3, torn: 0.6, burn: 0.9, plates: 0.2, beacon: 0 },   // nose torn off, burnt black
        { x: 560, y: 196, len: 122, from: 0, to: 0.27, yaw: 0, roll: 0.95, ri: 3, torn: 0.62, burn: 0.8 },               // its nose, drifting ahead
        { x: 604, y: 352, len: 230, from: 0.04, to: 0.62, yaw: 0.03, roll: -0.08, torn: 0.61, burn: 0.6, plates: 0.24 },  // big, lower right
        { x: 342, y: 64, len: 66, from: 0, to: 0.55, yaw: -0.06, roll: 0.06, ri: 2 },
        { x: 284, y: 52, len: 66, from: 0.6, to: 1, yaw: 0.1, roll: -0.4, ri: 2 },
        { x: 424, y: 128, len: 54, from: 0.42, to: 1, yaw: -0.05 },
        { x: 240, y: 118, len: 42, from: 0, to: 1, yaw: 0.06, beacon: 2 },
        { x: 40, y: 160, len: 48, from: 0, to: 0.66, yaw: 0.03, ri: 4 },
        { x: 196, y: 334, len: 74, from: 0.38, to: 1, yaw: -0.08, roll: 0.25 },
        { x: 382, y: 330, len: 58, from: 0, to: 1, yaw: 0.04, ri: 3 },
        { x: 618, y: 132, len: 36, from: 0, to: 1, yaw: -0.05, beacon: 2 },
        { x: 486, y: 40, len: 28, from: 0, to: 0.6, yaw: 0.02 },
        { x: 182, y: 36, len: 30, from: 0, to: 1, yaw: 0.05, ri: 2 },
        { x: 298, y: 140, len: 22, from: 0.35, to: 1, yaw: -0.1 },
        { x: 520, y: 112, len: 19, from: 0, to: 1, yaw: 0.04 },
        { x: 92, y: 214, len: 26, from: 0, to: 0.5, yaw: 0.08, ri: 4 },
        { x: 418, y: 222, len: 17, from: 0, to: 1, yaw: -0.04 },
        { x: 560, y: 300, len: 20, from: 0.5, to: 1, yaw: 0.2, roll: 0.6 },
        { x: 30, y: 60, len: 21, from: 0, to: 1, yaw: 0 },
        { x: 380, y: 26, len: 16, from: 0, to: 1, yaw: 0.04 },
        { x: 156, y: 168, len: 15, from: 0.3, to: 1, yaw: -0.06 },
        { x: 440, y: 186, len: 13, from: 0, to: 1, yaw: 0.02 },
        { x: 600, y: 240, len: 14, from: 0, to: 0.6, yaw: -0.03 },
    ];
    // The sea: 64,000 hulls (broken ones in two pieces). Most are spread evenly within 700 ship lengths of us, in a thick layer
    // above and below; the rest thin out to 7,000 lengths in a flatter sheet toward the light. What can be seen grows as the
    // camera pulls back (SEEN, in camera distances): first the wrecks round us, then hundreds, then thousands.
    // PASS: wrecks along the camera's way back, `edge` pixels from our dot when the camera stops at one of the pulls' ends, so
    // as the camera pulls back they slide in from the edges of the frame, big and close, and at no stop cover us or the light.
    const SEA_N = 64000, SEA_RHO = [4, 7000], SEA_EVEN = [700, 0.7], SEEN = [3.6, 7.2];
    const PASS = { n: [500, 700, 1300], stops: [24, 110, 270], edge: [40, 440], clear: 0.6 };
    const at3 = (u, w, h) => [0, 1, 2].map(k => u * HEAD[k] + w * SIDE[k] + h * NRM[k]);
    /** One hull into the list: whole (a quarter of them), or snapped in two with the halves drifting apart along the heading,
        the engine half turning away; sometimes one half is gone. */
    function addHull(list, base, r) {
        if (r() < 0.25) { list.push(Object.assign(base, { from: 0, to: 1, anchor: 0.5 })); return; }
        const p = base.p, cut = Math.round((0.3 + r() * 0.4) * 10) / 10, gap = 0.1 + r() * 0.5, drift = (r() - 0.5) * 0.7, keep = r();
        const front = Object.assign({}, base, { from: 0, to: cut, anchor: cut / 2, p: madd(p, [0.5 - cut / 2 + gap / 2, HEAD]), broken: true });
        const back = Object.assign({}, base, { from: cut, to: 1, anchor: (1 + cut) / 2, seed: base.seed + 1, roll: (r() - 0.5) * 1.4, broken: true,
            p: madd(p, [0.5 - (1 + cut) / 2 - gap / 2, HEAD], [drift, SIDE], [drift * 0.4, NRM]) });
        if (keep > 0.1) list.push(front);
        if (keep < 0.9) list.push(back);
    }
    function makeSea() {
        const r = seeded(4242), list = [];
        NEAR.forEach((o, i) => {
            const seed = 100 + i, d = dmgFor(seed);
            list.push(Object.assign({ seed, ri: i % 2 ? 0 : 1, yaw: 0, roll: 0, near: true, p: placeOnScreen(o.x, o.y, o.len), anchor: (o.from + o.to) / 2,
                dmg: { torn: o.torn || d.torn, burn: o.burn == null ? d.burn : o.burn, plates: o.plates == null ? d.plates : o.plates, beacon: o.beacon != null } }, o));
        });
        const camRay = norm(CAMDIR).map(v => -v);
        const baseAt = (p, rho) => ({ p, rho, fade: r(), yaw: (r() - 0.5) * 0.24, roll: (r() - 0.5) * 0.12, seed: Math.floor(r() * 997), ri: Math.floor(r() * RAMPS.length), kind: 0 });
        let n = 0;
        while (n < SEA_N) {
            const rho = r() < SEA_EVEN[1] ? Math.max(SEA_RHO[0], SEA_EVEN[0] * Math.sqrt(r())) : SEA_EVEN[0] + (SEA_RHO[1] - SEA_EVEN[0]) * r(), th = r() * Math.PI * 2;
            const u = rho * Math.cos(th), w = rho * Math.sin(th) * 1.15, h = (r() + r() + r() - 1.5) * (1.5 + 0.13 * Math.min(rho, 400));   // thick round us, flatter far off
            if (u < 0 && r() < 0.55) continue;                                                // fewer behind us than ahead
            if (rho > 60 && r() > 0.12 + 0.88 * smooth(0.36, 0.62, fbm(u / 420, w / 70 + h / 140, 77, 3))) continue;   // long drifts along the heading, gaps between
            const p = at3(u, w, h);
            if (dot(p, camRay) / rho > 0.985) continue;                                       // keep the camera's own path back clear
            const first = project(p, D0);
            if (first && first.len > 30 && first.x > -60 && first.x < AW + 60 && first.y > -60 && first.y < AH + 60) continue;   // the first look is composed by hand (NEAR)
            n++;
            addHull(list, baseAt(p, rho), r);
        }
        const lightAng = Math.atan2(VP[1] - OUR[1], VP[0] - OUR[0]), stops = PASS.stops;
        stops.forEach((E, k) => {
            for (let i = 0, tries = 0; i < PASS.n[k] && tries < 40000; tries++) {
                const d = lerp(3, E * 0.95, r()), edge = lerp(PASS.edge[0], PASS.edge[1], r()), a = r() * Math.PI * 2;
                if (Math.abs(Math.atan2(Math.sin(a - lightAng), Math.cos(a - lightAng))) < 0.22) continue;   // not across the light
                const o = edge * (E - d) / F;
                if (stops.some(D => D > d && F * o / (D - d) < Math.max(10, PASS.clear * F * LEN_K / (D - d)))) continue;   // not on top of our dot at a stop
                i++;
                const p = [-d * CAMDIR[0] + o * Math.cos(a), -d * CAMDIR[1] + o * Math.sin(a), -d * CAMDIR[2]];
                addHull(list, Object.assign(baseAt(p, Math.hypot(...p)), { pass: true }), r);
            }
        });
        list.forEach(s => { if (s.rho == null) s.rho = Math.hypot(...s.p); });
        return list;
    }
    /** Loose plating, girders and scraps drifting between them. */
    function makeDebris(SEA) {
        const r = seeded(777), list = [];
        const add = (c, spread, n, scale = 1) => {
            for (let i = 0; i < n; i++) {
                const k = r(), kind = k < 0.55 ? 0 : k < 0.85 ? 1 : 2;                        // a plate, a girder, a scrap
                const p = madd(c, [(r() - 0.5) * 2 * spread, HEAD], [(r() - 0.5) * 2 * spread, SIDE], [(r() - 0.5) * spread, NRM]);
                if (Math.hypot(...p) < 0.75) continue;                                       // not on top of us
                list.push({ p, kind, r: scale * (kind === 1 ? 0.05 + 0.13 * r() : kind === 0 ? 0.025 + 0.07 * r() : 0.012 + 0.025 * r()),
                    a0: r() * 6.283, spin: (r() - 0.5) * 0.7, vel: [0, 1, 2].map(() => (r() - 0.5) * 0.02), seed: Math.floor(r() * 997), lit: r() });
            }
        };
        SEA.forEach(s => {
            if (s.near) add(s.p, 0.25 + 0.5 * (s.to - s.from), Math.round(10 + 22 * (s.to - s.from) * (s.len > 60 ? 1 : 0.5)));
            else if (s.pass || (s.broken && s.rho < 160)) add(s.p, 0.5, s.pass ? 3 : 2);
        });
        for (let i = 0; i < 2600; i++) { const rho = 1 + 90 * r() ** 1.4, th = r() * 6.283; add(at3(rho * Math.cos(th), rho * Math.sin(th), (r() - 0.5) * 2), 0.1, 1); }
        return list;
    }

    // ═══ painting a wreck: NSPaint.hull's recipe, with the damage ═══
    /** o: { x, y, len, ht, angle, anchor, from, to, seed, ramp, dmg, sun, shape }. The nose points along `angle`.
        Returns { beacon: [x, y] relative to o.x, o.y, or null }. */
    function paintWreck(p, o) {
        const { len, ht, from, to, anchor, seed, dmg } = o, R = o.ramp, shape = o.shape, c = Math.cos(o.angle), s = Math.sin(o.angle);
        const at = (u, v) => { const a = -(u - anchor) * len, b = v * ht; return [o.x + a * c - b * s, o.y + a * s + b * c]; };
        const uvOf = (x, y) => { const dx = x + 0.5 - o.x, dy = y + 0.5 - o.y; return [anchor - (dx * c + dy * s) / len, (-dx * s + dy * c) / ht]; };
        const reach = Math.max(anchor - from, to - anchor) * len + ht * 0.7 + 2;
        const tiny = len < 16, small = len < 40;
        const ribP = Math.max(3, len * 0.04), ribW = Math.max(1, len / 150), lonW = Math.max(0.55, ht / 80), LON = [-0.4, -0.2, 0, 0.2, 0.4];
        const isFrame = (pu, v) => (((pu % ribP) + ribP) % ribP) < ribW || LON.some(k => Math.abs(v - k) * ht < lonW);
        const sU = Math.max(4, len * 0.1), sV = Math.max(2, ht * 0.42), skel = tiny ? 0 : Math.min(0.03 + 0.035 * hash(seed, 9, 5), 14 / len);
        const pw = Math.max(4, len / 15), sun = [Math.cos(o.angle) * 1.5, Math.sin(o.angle) * 1.5];
        const inside = (x, y) => { const [u, v] = uvOf(x, y); return u >= from && u <= to && shape(u, v, o) >= 0; };
        p.region(o.x - reach, o.y - reach, o.x + reach, o.y + reach, (x, y) => {
            const [u, v] = uvOf(x, y);
            if (u < from - 0.12 || u > to + 0.12) return;
            let l = shape(u, v, o);
            if (l < 0) return;
            const pu = u * len, pv = v * ht, jag = (vnoise(v * 7, u * 11, seed) - 0.5) * 0.15 + (vnoise(v * 21, 3, seed + 1) - 0.5) * 0.07;
            let e = 9;
            if (to < 1) e = Math.min(e, to + jag - u);
            if (from > 0) e = Math.min(e, u - from + jag);
            if (e < 0) return;
            let r = R;
            if (e < skel) {                                                                    // the break: only the frame is left standing
                if (!isFrame(pu, v)) return;
                p.solid(x, y, DEAD, (v < 0 ? 0.62 : 0.4) * (1 - 0.3 * u));
                return;
            }
            const tm = fbm(pu / sU, pv / sV, seed + 3, 3) + (e < skel + 0.1 ? 0.07 : 0);       // torn worst near the break
            if (tm > dmg.torn) {                                                               // torn open
                if (!tiny && tm < dmg.torn + 0.022) l = v < 0.1 ? 0.8 : 0.55;                  // the ragged edge of the skin
                else if (!tiny && isFrame(pu, v)) l = 0.44;                                    // ribs and longerons
                else if (len < 48 || fbm(pu / sU, pv / sV, seed + 5, 2) < 0.52) { l = 0.05; r = BURNT; }   // the gutted inside (small: keep the hull's outline whole)
                else return;                                                                   // straight through: space behind
            } else {
                const iu = Math.floor(pu / pw), iv = Math.floor((v + 0.6) * 3);
                if (!tiny && hash(iu & 255, iv + 7, seed) < dmg.plates) l = isFrame(pu, v) ? 0.42 : 0.14;   // a plate gone: the frame under it
                else if (!small && (((pu % pw) + pw) % pw) < 0.8) l -= 0.08;                   // plate seams
                if (!small) l -= (fbm(pu / 9, pv / 6, seed, 3) - 0.45) * 0.4;
                const bm = fbm(pu / Math.max(5, len * 0.08), pv / Math.max(2, ht * 0.35), seed + 11, 3) + 0.3 * (1 - smooth(0, 0.16, e - skel)) + 0.2 * smooth(dmg.torn - 0.1, dmg.torn, tm);
                if (bm > 1.02 - dmg.burn * 0.5) { r = BURNT; l *= 0.65; }                      // burnt black
            }
            l *= 1 - 0.28 * clamp01(u);                                                        // lit from ahead: the tail is in shadow
            if (o.sun && r !== BURNT && !inside(x + sun[0], y + sun[1]) && threshold(x, y) < o.sun) { p.solid(x, y, RP.SUN, 0.45 + 0.35 * o.sun); return; }
            l *= 0.84;                                                                         // dead metal: no shine
            if (small) { const top = r.hex.length - 1; p.solid(x, y, r, Math.round(clamp01(l) * top) / top); return; }
            p.solid(x, y, r, l);
        });
        if (len < 22) return { beacon: null };
        const rand = seeded(seed * 31 + 7), w = len > 160 ? 2 : 1;
        const vdir = [-s, c], udir = [-c, -s];                                                  // +v across, +u toward the tail
        const stroke = (x0, y0, x1, y1, rr, v) => p.line(x0, y0, x1, y1, (x, y) => { for (let k = 0; k < w; k++) p.solid(x + (k ? vdir[0] : 0), y + (k ? vdir[1] : 0), rr, v); });
        [[to < 1, to, 1], [from > 0, from, -1]].forEach(([isCut, cu, out]) => {                // bent girders sticking out of each break
            if (!isCut) return;
            LON.forEach(k => {
                if (rand() < 0.35) return;
                const [x0, y0] = at(cu - out * 0.03, k), [x1, y1] = at(cu + out * (0.03 + 0.09 * rand()), k + (rand() - 0.5) * 0.5);
                stroke(x0, y0, x1, y1, DEAD, k < 0 ? 0.6 : 0.42);
            });
        });
        const peel = len < 30 ? 1 : Math.round(dmg.plates * 12) + 1;                          // plates peeled back from the skin, bent away from the light
        for (let i = 0; i < peel; i++) {
            const u0 = from + (to - from) * (0.12 + 0.76 * rand()), side = rand() < 0.65 ? -1 : 1;
            if (shape(u0, 0, o) < 0) continue;
            const [bx, by] = at(u0, side * 0.47), Lp = ht * (0.14 + 0.3 * rand()), Wp = Math.max(1.5, len * (0.02 + 0.025 * rand())), lean = 0.3 + 0.8 * rand();
            for (let a = 0; a <= Lp; a += 0.5) {
                const bend = lean * (a / Lp) ** 1.5, dx = side * vdir[0] + bend * udir[0], dy = side * vdir[1] + bend * udir[1], dn = Math.hypot(dx, dy);
                for (let b = 0; b <= Wp; b += 0.5) p.solid(bx + dx / dn * a + udir[0] * b, by + dy / dn * a + udir[1] * b, R === BURNT ? BURNT : DEAD, (side < 0 ? 0.66 : 0.36) - 0.22 * a / Lp + (b < 0.6 ? 0.12 : 0));
            }
        }
        if (!dmg.beacon || from > LANDER.NOSE) return { beacon: null };
        const [lx, ly] = at(LANDER.NOSE + 0.05, -0.5);
        p.set(lx, ly, RP.RED.rgb[1]); if (len > 80) p.set(lx + 1, ly, RP.RED.rgb[1]);           // the beacon: a dead red lamp
        return { beacon: [lx - o.x, ly - o.y] };
    }

    const quantLen = l => (l < 36 ? Math.round(l) : Math.round(Math.exp(Math.round(Math.log(l) * 30) / 30)));
    const quantDeg = a => Math.round(a * 60 / Math.PI) * 3;
    const glowAt = (x, y) => (Math.abs(x - VP[0]) > 160 || Math.abs(y - VP[1]) > 120 ? 0 : Math.exp(-Math.hypot(x - VP[0], (y - VP[1]) * 1.4) / 46));
    const SIL = P.hexRgb(INK);

    // ═══ one film's pictures ═══
    function create() {
        const A = { SEA: null, DEBRIS: null, BG: null, packed: null, cache: new Map(), families: new Map(), bakeLeft: Infinity, built: false };
        const dead = document.createElement('canvas'); dead.width = AW; dead.height = AH;
        const dctx = dead.getContext('2d'); dctx.imageSmoothingEnabled = false;
        const LAYER = P.pixelLayer(AW, AH), STREAKS = P.pixelLayer(AW, AH);
        const scratches = new Map(), holePat = new Map(), dimPat = new Map();

        // ── sprites, baked on first use at whole sizes; while the film plays, a budget per frame (the nearest size stands in) ──
        const BAKE_MS = 6;
        function cached(key, make) {
            let sp = A.cache.get(key);
            if (!sp) {
                if (A.cache.size > 9000) { let n = 0; for (const k of A.cache.keys()) { A.cache.delete(k); if (++n > 2500) break; } A.families.clear(); }   // drop the oldest
                sp = make(); A.cache.set(key, sp);
            }
            return sp;
        }
        function wreckSprite(len, deg, s) {
            const small = len < 30 && !s.near, pseed = small ? 1 + (s.seed % 18) : s.seed;      // small ones share a few damage patterns, ramps and headings
            const ri = small ? s.ri % 4 : s.ri;
            if (small) deg = Math.round(deg / 6) * 6;
            const fam = 'w' + pseed + ':' + s.from + ':' + s.to + ':' + ri + '|' + deg, key = fam + '|' + len;
            const have = A.cache.get(key);
            if (have) return { sp: have, k: 1 };
            if (A.bakeLeft <= 0) {                                                             // over budget: the nearest size baked, at this heading or the next one over
                for (const dd of [0, -3, 3, -6, 6]) {
                    const f2 = fam.slice(0, fam.lastIndexOf('|') + 1) + (deg + dd), sizes = A.families.get(f2);
                    let best = 0;
                    if (sizes) for (const l of sizes) if (A.cache.has(f2 + '|' + l) && (!best || Math.abs(Math.log(l / len)) < Math.abs(Math.log(best / len)))) best = l;
                    if (best) return { sp: A.cache.get(f2 + '|' + best), k: len / best };
                }
            }
            const t0 = performance.now(), sp = bakeWreck(len, deg, s, pseed, ri);
            A.bakeLeft -= performance.now() - t0;
            A.cache.set(key, sp);
            if (!A.families.has(fam)) A.families.set(fam, new Set());
            A.families.get(fam).add(len);
            return { sp, k: 1 };
        }
        function bakeWreck(len, deg, s, pseed, ri) {
            const ht = len / 3.15, half = Math.ceil(len * 0.5 + ht + 4), p = P.painter(half * 2, half * 2, false);
            const d0 = s.near ? s.dmg : dmgFor(pseed), k = clamp01((60 - len) / 50);       // the smaller, the gentler: the Lander's shape must still read
            const dmg = { torn: d0.torn + 0.07 * k, burn: d0.burn, plates: d0.plates * (1 - 0.6 * k), beacon: d0.beacon };
            const res = paintWreck(p, { x: half, y: half, len, ht, angle: deg * Math.PI / 180, anchor: s.anchor, from: s.from, to: s.to, seed: pseed, ramp: RAMPS[ri], dmg,
                sun: len > 40 ? 0.2 : 0, shape: P.shapeL });
            return { canvas: p.canvas(), half, beacon: res.beacon };
        }
        function ourSprite(len, deg, dark) {
            return cached('o' + (dark ? 'd' : '') + '|' + len + '|' + deg, () => {
                const ht = len / 3.15, half = Math.ceil(len / 2 + ht + 3), p = P.painter(half * 2, half * 2, false), a = deg * Math.PI / 180;
                const at = P.hull(p, { x: half, y: half, len, ht, angle: a, flip: true, seed: 9, anchor: 0.5, sun: dark ? 0.36 : len < 80 ? 0.24 : 0.3, sunDir: [Math.cos(a), Math.sin(a)], fade: 0.22, light: dark ? 0.3 : 1, flat: len < 130 }, P.shapeL);
                return { canvas: p.canvas(), half, ports: [0, 1, 2, 3, 4, 5].map(i => at(DECK_U(i) + 0.054, -0.32).map(v => v - half)), lamp: at(LANDER.NOSE + 0.06, -0.52).map(v => v - half), bell: at(1, 0).map(v => v - half) };
            });
        }

        // ── the far background: space, haze, stars and the light, painted once ──
        function background() {
            if (A.BG) return A.BG;
            const p = P.painter(AW, AH, true), lt = { core: 3.2, halo: 26, strength: 0.95, spikes: 30 };
            p.region(0, 0, AW, AH, (x, y) => {
                const v = Math.max(0, fbm(x / 80, y / 42, 31, 4) - 0.46) * 0.9, g = 0.22 * Math.exp(-Math.hypot(x - VP[0], (y - VP[1]) * 1.8) / 140);
                if (v + g > 0.03) p.tone(x, y, RP.HAZE, v + g);
            });
            const stars = P.keepVisible(p, P.scatterStars(p, 33, 1500, (x, y) => Math.hypot(x - VP[0], y - VP[1]) > 26 && (y < VP[1] + 6 || hash(x, y, 4) < 0.35)));   // fewer stars below the sea's horizon
            P.lightGlow(p, VP[0], VP[1], lt);
            A.BG = { canvas: p.canvas(), stars: stars.filter(s => s.mag > 0.9), all: stars };
            return A.BG;
        }
        /** The sea's hot fields, packed into typed arrays (the loop over every hull runs each frame). */
        function pack() {
            const SEA = A.SEA, SN = SEA.length, K = { SN, SX: new Float32Array(SN), SY: new Float32Array(SN), SZ: new Float32Array(SN), SDMIN: new Float32Array(SN),
                SCA: new Float32Array(SN), SSA: new Float32Array(SN), SJ: new Float32Array(SN), SGAP: new Int8Array(SN), SBURNT: new Uint8Array(SN), SNEAR: new Uint8Array(SN) };
            SEA.forEach((s, i) => {
                const a = HEAD_ANG + s.yaw * 0.5;
                let kf = 0.5; for (let k = 0, lo = 0, hi = 1; k < 20; k++) { kf = (lo + hi) / 2; if (smooth(0, 1, kf) < s.fade) lo = kf; else hi = kf; }   // when it comes out of the dark (SEEN)
                K.SDMIN[i] = s.near || s.pass || s.rho <= 12 ? 0 : s.rho / (SEEN[1] - (SEEN[1] - SEEN[0]) * kf);
                K.SX[i] = s.p[0]; K.SY[i] = s.p[1]; K.SZ[i] = s.p[2]; K.SCA[i] = Math.cos(a); K.SSA[i] = Math.sin(a); K.SJ[i] = hash(s.seed, 1, 3) * 0.08;
                K.SGAP[i] = s.broken ? (s.from > 0 ? 2 : 0) : -1; K.SBURNT[i] = RAMPS[s.ri] === BURNT ? 1 : 0; K.SNEAR[i] = s.near ? 1 : 0;
            });
            A.packed = K;
        }

        // ── drawing the graveyard ──
        function smallWreck(L, pr, s, ang, g) {
            const ca = Math.cos(ang), sa = Math.sin(ang), n = Math.max(3, Math.round(pr.len * 1.1)), m = Math.max(2, Math.round(n * (s.to - s.from))), rows = pr.len >= 4 ? 2 : 1;
            const R = RAMPS[s.ri] === BURNT ? BURNT : FAR, nosed = s.from === 0, d = dmgFor(1 + (s.seed % 18));
            for (let i = 0; i < m; i++) for (let j = 0; j < rows; j++) {
                const x = pr.x + (i - (m - 1) / 2) * ca - (j - (rows - 1) / 2) * sa, y = pr.y + (i - (m - 1) / 2) * sa + (j - (rows - 1) / 2) * ca;
                if (g > 0.6) { L.set(x, y, SIL); continue; }
                if (!nosed && i === m - 1 && j === 0) continue;                                   // the ragged break
                if (s.to < 1 && i === 0 && j === rows - 1) continue;
                if (m >= 4 && i === (s.seed % (m - 2)) + 1 && j === 0 && d.torn < 0.6) { L.tone(x, y, BURNT, 0.15); continue; }   // a hole in the side
                L.tone(x, y, R, (j === 0 ? 0.6 : 0.36) + (i === m - 1 && nosed ? 0.18 : 0) + 0.1 * g);
            }
            if (s.broken && g <= 0.6) { const e = s.from > 0 ? (m + 1) / 2 : -(m + 1) / 2; L.tone(pr.x + e * ca + sa, pr.y + e * sa - ca, FAR, 0.4); }   // a scrap off the break
        }
        function farWreck(L, x0, y0, len, i, g, fog) {
            const K = A.packed, m = len < 1.3 ? 2 : 3, ca = K.SCA[i], sa = K.SSA[i], R = K.SBURNT[i] ? BURNT : FAR;
            for (let k = 0; k < m; k++) {
                if (m === 3 && k === K.SGAP[i]) continue;
                const x = x0 + (k - (m - 1) / 2) * ca, y = y0 + (k - (m - 1) / 2) * sa;
                if (g > 0.6) { L.set(x, y, SIL); continue; }
                L.tone(x, y, R, ((k === m - 1 ? 0.66 : 0.42) + K.SJ[i] + 0.15 * g) * fog);
            }
        }
        function drawDebris(f, L, d, pr, t) {
            const S = pr.len * d.r, g = glowAt(pr.x, pr.y);
            if (S < 0.55) return;
            if (S < 1.6) { if (g > 0.35) L.set(pr.x, pr.y, SIL); else L.tone(pr.x, pr.y, FAR, 0.3 + 0.2 * d.lit); return; }
            const a = d.a0 + d.spin * t / 1000, ca = Math.cos(a), sa = Math.sin(a), face = Math.max(0, Math.cos(a * 2 + d.seed)), R = d.seed % 4 === 0 ? BURNT : DEAD;
            const len = d.kind === 2 ? S * 0.8 : S, wd = d.kind === 1 ? Math.max(1, Math.round(S / 12)) + (S > 14 ? 3 : 0) : d.kind === 0 ? Math.max(1, S * 0.45) : S * 0.7;
            const reach = Math.ceil(Math.hypot(len, wd) / 2) + 1, cx = Math.round(pr.x), cy = Math.round(pr.y);
            for (let y = -reach; y <= reach; y++) for (let x = -reach; x <= reach; x++) {
                const i = x * ca + y * sa, k = -x * sa + y * ca;
                if (Math.abs(i) > len / 2 + 0.3) continue;
                let v;
                if (d.kind === 1) {
                    const core = Math.max(1, Math.round(S / 12));
                    if (k >= -0.5 && k < core - 0.5) v = 0.42 + 0.2 * face;
                    else if (S > 14 && k >= core - 0.5 && k < core + 2.5 && ((i + len / 2) % 4) < 1) v = 0.3;
                    else continue;
                } else {
                    if (Math.abs(k) > wd / 2 + 0.3) continue;
                    if (d.kind === 2 && hash(Math.round(i + 9), Math.round(k + 9), d.seed) < 0.3) continue;
                    v = (d.kind === 0 ? 0.26 + 0.5 * face : 0.22) + (k > wd / 2 - 0.8 ? 0.14 : 0);
                }
                f.tone(cx + x, cy + y, R, v);
            }
        }
        function drawSea(t, D, still) {
            const K = A.packed, SEA = A.SEA;
            dctx.clearRect(0, 0, AW, AH);
            const L = LAYER, big = [], mid = [], f = P.framer(dctx, AW, AH), ours = F / D * LEN_K * 0.5;
            const cx = D * CAMDIR[0], cy = D * CAMDIR[1], cz = D * CAMDIR[2];
            L.clear();
            const H0 = HEAD[0], H1 = HEAD[1], H2 = HEAD[2], X0 = C0[0], Y0 = C0[1];
            for (let i = 0; i < K.SN; i++) {
                if (D < K.SDMIN[i]) continue;                                                  // too far off to make out yet
                const rz = K.SZ[i] + cz;
                if (rz < 0.4) continue;
                const iz = F / rz, rx = K.SX[i] + cx, ry = K.SY[i] + cy, x = X0 + rx * iz, y = Y0 + ry * iz;
                if (x < -300 || x > AW + 300 || y < -200 || y > AH + 200) continue;
                const n = Math.sqrt(rx * rx + ry * ry + rz * rz), along = (rx * H0 + ry * H1 + rz * H2) / n, side = Math.sqrt(Math.max(0, 1 - along * along));
                const len = iz * LEN_K * (0.45 + 0.55 * Math.min(1, side / 0.6));             // seen nose-on, a hull looks shorter
                if (len > 460 || (len < 6.5 && (x < -4 || x > AW + 4 || y < -4 || y > AH + 4))) continue;
                const near = K.SNEAR[i] === 1;
                if (!near && Math.abs(x - VP[0]) < 9 + len * 0.6 && Math.abs(y - VP[1]) < 9 + len * 0.6) continue;   // keep the light clear
                if (!near && rz < D && Math.hypot(x - OUR[0], y - OUR[1]) < ours + len * 0.45 + 0.8) continue;   // nothing in front of us hides us
                const g = glowAt(x, y);
                if (len < 0.45) { if (g > 0.6) L.set(x, y, SIL); else L.tone(x, y, FAR, (0.34 + 0.12 * g) * (1 - 0.45 * smooth(120, 1600, rz))); continue; }
                if (len < 2.6) { farWreck(L, x, y, len, i, g, 1 - 0.45 * smooth(120, 1600, rz)); continue; }
                (len < 6.5 ? mid : big).push([{ x, y, len, z: rz }, SEA[i], 0, 0]);
            }
            const tk = t / 1000;
            for (const d of A.DEBRIS) {
                const rz = d.p[2] + d.vel[2] * tk + cz;
                if (rz < 0.4) continue;
                const iz = F / rz, x = C0[0] + (d.p[0] + d.vel[0] * tk + cx) * iz, y = C0[1] + (d.p[1] + d.vel[1] * tk + cy) * iz, S = iz * LEN_K * d.r;
                if (S < 0.55 || S > 70 || x < -40 || x > AW + 40 || y < -40 || y > AH + 40 || (Math.abs(x - VP[0]) < 8 + S && Math.abs(y - VP[1]) < 8 + S)) continue;
                const pr = { x, y, len: iz * LEN_K, z: rz };
                if (S < 1.6) drawDebris(f, L, d, pr, t); else big.push([pr, d, 0, 1]);
            }
            mid.sort((a, b) => b[0].z - a[0].z);
            for (const [pr, s] of mid) smallWreck(L, pr, s, headingAt(pr.x, pr.y, s.yaw) + (pr.len >= 3 ? s.roll : 0), glowAt(pr.x, pr.y));
            L.draw(dctx);
            big.sort((a, b) => b[0].z - a[0].z);
            for (const [pr, s, , isDebris] of big) {
                if (isDebris) { drawDebris(f, L, s, pr, t); continue; }
                const ang = headingAt(pr.x, pr.y, s.yaw) + s.roll;
                const { sp, k } = wreckSprite(quantLen(pr.len), quantDeg(ang), s), h = sp.half * k, x = Math.round(pr.x - h), y = Math.round(pr.y - h);
                if (k === 1) dctx.drawImage(sp.canvas, x, y); else dctx.drawImage(sp.canvas, x, y, Math.round(sp.canvas.width * k), Math.round(sp.canvas.height * k));
                if (sp.beacon && pr.len >= 14) {                                               // a dead beacon, still ticking over now and then
                    const per = 2600 + (s.seed % 7) * 430, on = !still && (t + s.seed * 137) % per < 160, bx = Math.round(pr.x + sp.beacon[0] * k), by = Math.round(pr.y + sp.beacon[1] * k);
                    if (on) { f.glow(bx, by, 2, RP.RED, 0.35); f.px(bx, by, RP.RED.hex[2]); }
                }
            }
        }

        /** Our ship: dark and cold, one red lamp; the drive relights at the end, white. */
        function drawOurs(ctx, t, D, still) {
            const len = quantLen(F / D * LEN_K), deg = quantDeg(Math.atan2(VP[1] - OUR[1], VP[0] - OUR[0])), f = P.framer(ctx, AW, AH), ts = step8(t);
            if (len >= 7) {
                const sp = ourSprite(len, deg, false), cxp = OUR[0], cyp = OUR[1];
                const cold = 1 - smooth(TL.relight, TL.relight + 700, t);                      // the hull dark with its decks, until the drive catches
                if (cold >= 1) { const dk = ourSprite(len, deg, true); ctx.drawImage(dk.canvas, cxp - dk.half, cyp - dk.half); }   // all dark: the dark hull alone, no copy a frame
                else {
                    ctx.drawImage(sp.canvas, cxp - sp.half, cyp - sp.half);
                    if (cold > 0) {
                        const dk = ourSprite(len, deg, true), tmp = scratch(dk.canvas.width, dk.canvas.height), g = tmp.getContext('2d');
                        g.clearRect(0, 0, tmp.width, tmp.height); g.drawImage(dk.canvas, 0, 0); ditherIn(g, cold, tmp.width, tmp.height);
                        ctx.drawImage(tmp, cxp - dk.half, cyp - dk.half);
                    }
                }
                const burn = t > TL.relight ? smooth(TL.relight, TL.relight + 500, t) * 1.6 : 0;
                if (burn > 0.02) {
                    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), s = len / 48, [bx, by] = sp.bell, lvl = burn * 1.4, fl = still ? 1 : [1, 0.75, 1.15, 0.9][Math.floor(ts / TICK) % 4];
                    const pl = (6 + 20 * lvl) * s * fl, w0 = Math.max(1, 1.8 * s);
                    for (let d = 0; d < pl; d++) { const hw = w0 * (1 - (d / pl) * 0.6); for (let k = -Math.ceil(hw); k <= Math.ceil(hw); k++) { const u = Math.abs(k) / (hw + 0.01), v = (1 - d / pl) ** 0.8 * (1 - u * u); if (v > 0.06) f.tone(cxp + bx - ca * d - sa * k, cyp + by - sa * d + ca * k, RP.PLUME, v); } }
                }
                sp.ports.forEach(([px, py], i) => {                                            // the ports come back on as the drive catches
                    if (t > TL.relight + 300 && hash(i, 1, 2) > 0.2) f.px(cxp + px, cyp + py, RP.AMBER.hex[i === 0 ? 4 : 3]);
                });
                lampAt(f, cxp + sp.lamp[0], cyp + sp.lamp[1], t, len / 12, still);
            } else {                                                                            // a dot: the red lamp is how you find us
                const k = clamp01((len - 1) / 6);
                if (k > 0.3) f.px(OUR[0] - 1, OUR[1], RP.HULL.hex[2], 3, 1);
                lampAt(f, OUR[0], OUR[1] - (k > 0.3 ? 1 : 0), t, 1, still);
                if (t > TL.relight) { const v = smooth(TL.relight, TL.relight + 600, t); f.glow(OUR[0] - 2, OUR[1] + 1, 4, RP.PLUME, v); f.px(OUR[0] - 2, OUR[1] + 1, RP.PLUME.hex[5]); }
            }
        }
        /** The red lamp on our hull (the prototype's redLamp): a slow blink, 0.9 s on in every 2.2; steady when still. */
        function lampAt(f, x, y, t, scale, still) {
            const on = still || (t % 2200) < 900, r = Math.max(4, Math.round(3 + scale));
            if (scale <= 1) {                                                                   // a dot: a small bright cross, no dark halo round it on the grey field
                if (on) { f.px(x - 2, y, RP.RED.hex[2], 5, 1); f.px(x, y - 2, RP.RED.hex[2], 1, 5); f.px(x - 1, y - 1, RP.RED.hex[3], 3, 3); }
                else { f.px(x - 1, y, RP.RED.hex[2], 3, 1); f.px(x, y - 1, RP.RED.hex[2], 1, 3); }
                f.px(x, y, RP.RED.hex[on ? 4 : 3]);
                return;
            }
            if (on) { f.glow(x, y, r, RP.RED, 0.9); f.px(x, y, RP.RED.hex[4]); }
            else { f.glow(x, y, 3, RP.RED, 0.55); f.px(x, y, RP.RED.hex[3]); }
        }
        /** The jump comes back: every star pulled out into a streak toward the light. */
        function drawStreaks(ctx, k) {
            if (k <= 0.01) return;
            const L = STREAKS;
            L.clear();
            background().all.forEach(st => {
                const dx = VP[0] - st.x, dy = VP[1] - st.y, d = Math.hypot(dx, dy) || 1, len = Math.min(d - 4, k * k * (40 + d * 0.5) * (0.5 + st.mag));
                for (let i = 0; i < len; i++) L.tone(st.x - dx / d * i * 0.4 + dx / d * i, st.y - dy / d * i * 0.4 + dy / d * i, RP.STAR, (0.4 + 0.55 * st.mag) * (1 - i / len));
            });
            L.draw(ctx);
        }
        function scratch(w, h) { const k = w + 'x' + h; if (!scratches.has(k)) { const c = document.createElement('canvas'); c.width = w; c.height = h; scratches.set(k, c); } return scratches.get(k); }
        /** Fade a layer in with the house dither: only the pixels whose Bayer threshold is under `amount` survive. */
        function ditherIn(c2, amount, w = AW, h = AH) {
            const n = Math.round(clamp01(amount) * 16);
            if (n >= 16) return;
            if (!holePat.has(n)) { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = '#000'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (threshold(x, y) >= n / 16) g.fillRect(x, y, 1, 1); holePat.set(n, c2.createPattern(c, 'repeat')); }
            c2.save(); c2.globalCompositeOperation = 'destination-out'; c2.fillStyle = holePat.get(n); c2.fillRect(0, 0, w, h); c2.restore();
        }
        function dim(ctx, a, colour = INK) {
            const n = Math.round(clamp01(a) * 8); if (!n) return;
            if (n >= 8) { ctx.fillStyle = colour; ctx.fillRect(0, 0, AW, AH); return; }
            const key = colour + n;
            if (!dimPat.has(key)) { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = colour; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (threshold(x, y) < n / 8) g.fillRect(x, y, 1, 1); dimPat.set(key, ctx.createPattern(c, 'repeat')); }
            ctx.fillStyle = dimPat.get(key); ctx.fillRect(0, 0, AW, AH);
        }

        function draw(ctx, t, still, playing) {
            if (!A.built) { ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, AH); return; }
            A.bakeLeft = playing ? BAKE_MS : Infinity;
            const B = background(), f = P.framer(ctx, AW, AH), ts = step8(t), D = distAt(t);
            ctx.drawImage(B.canvas, 0, 0);
            const stretch = still ? 0 : smooth(TL.relight + 300, TL.white[0], t);             // the jump comes back as the drive catches
            if (stretch < 0.5) P.twinkle(f, B.stars, ts);
            drawStreaks(ctx, stretch);
            const seen = smooth(TL.reveal[0], TL.reveal[1], t);
            if (seen > 0) { drawSea(t, D, still); ditherIn(dctx, seen); ctx.drawImage(dead, 0, 0); }
            drawOurs(ctx, t, D, still);
            if (t < TL.in) dim(ctx, 1 - t / TL.in);
            if (still) { if (t >= TL.relight + 600) dim(ctx, smooth(TL.relight + 600, TL.end, t)); }   // reduced motion: no white, a slow fade to ink
            else if (t >= TL.white[0]) { dim(ctx, smooth(TL.white[0], TL.white[0] + 200, t), RP.SUN.hex[6]); dim(ctx, smooth(TL.white[1], TL.end, t)); }
        }

        // the work, in jobs: the far field, the sea, its packing, the debris, then the nearest wrecks at their first sizes
        const jobs = [
            () => background(),
            () => { A.SEA = makeSea(); },
            () => pack(),
            () => { A.DEBRIS = makeDebris(A.SEA); },
            () => { ourSprite(quantLen(F / D0 * LEN_K), quantDeg(Math.atan2(VP[1] - OUR[1], VP[0] - OUR[0])), false); ourSprite(quantLen(F / D0 * LEN_K), quantDeg(Math.atan2(VP[1] - OUR[1], VP[0] - OUR[0])), true); A.built = true; },
        ];
        NEAR.forEach((o, i) => jobs.push(() => {                                               // the graveyard round us, as it first comes out of the dark
            const s = A.SEA[i], pr = project(s.p, D0);
            if (!pr) return;
            A.bakeLeft = Infinity;
            wreckSprite(quantLen(pr.len), quantDeg(headingAt(pr.x, pr.y, s.yaw) + s.roll), s);
        }));
        return { jobs, ready: () => A.built, draw, A };
    }

    window.NSSeaArt = Object.freeze({ AW, AH, TL, DUR, create, state: art => ({ built: !!(art && art.A.built), cached: art ? art.A.cache.size : 0 }) });
})();
