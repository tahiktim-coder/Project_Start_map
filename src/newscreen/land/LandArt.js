/* ═══ Silent Exodus · new screen (?new=1) · land/LandArt.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/landing-art.js (sha1 75fb6c9306c5, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   GAME: no tower (TOWER_W 0); the globe is the glass's world (NSWorlds.paint gets the node, as stop/Glass.js paints it);
   forget(worldId) lets a world's globes and entry go. hullShadow stays exported, unused.
*/
/* ═══ Silent Exodus · prototypes · landing-meteor/landing-art.js (the meteor adds one nearer band of the cloud sea and
   exports ENTRY, drawHull and shuttleSprite; its sprite cache is capped): the landing dummy's pictures above the ground ══════════════════
   What it is: the art of the orbit, the long way down and the cloud deck, for the landing dummy (index.html, landing.js).
   Everything is the game's own recipe, loaded as it is: NSPaint (ramps, the 8 x 8 Bayer dither, noise, the false sun, our
   Lander's hull), NSSky / NSSky2 (the sector's far sky), NSWorlds (the world, the same picture the bridge glass shows),
   LanderScene.look (this world's air, cloud and ground colours). Nothing here changes the game.
   One idle queue does every heavy bake a few milliseconds at a time (the globe at r 87, 150 and 260, the entry's limb, its
   cloud sea, haze and tints, the cloud deck), so no frame waits on a painting and no frame paints a whole screen by hand.
   The lights: every find shows by its own light, drawn by one function at every height (the globe, the air, the cloud, the
   ground), so the light you click from orbit is the light you land beside. Nothing points.
   NO SOUND: nothing here makes any.

   window.LandingArt (frozen)
     FW, FH, TOWER_W, ORBIT, LW, LIGHT        the 640 x 360 frame, the tower's 112 px, the glass framing, the light
     later(fn, tag, soon), idle(ms), drop(tag), promote(tag), pending(tag)   the idle queue (soon: true hi, 'bg' last)
     orbitSky(sector) → { canvas, stars }     the sector's sky (built at once: call it in the first second)
     hullShadow(ctx)                          the picture darkening toward the ink beside the tower's hull (it runs on under it)
     globe(world, r) → { canvas, half, r, done }   the world baked at radius r in strips (queued)
     drawLight(f, kind, x, y, t, o) → drawn   a find's light (kind: wreck colony flare signal life machines geyser vent
                                              devil smoke none); o: { night, cloud (0..1 seen through air or cloud), wind,
                                              scale, orbit (on the globe: a core and its glow, nothing round it), chosen, warm,
                                              post, out, burn, pre, beat (0..1: it slides in under us), lit (on a lit
                                              surface: its glow only brightens, no dark ring) }
     entry(world, S) → E                      the long way down's still layers and its cloud deck (queued): E.done
     drawEntry(ctx, E, v, t)                  one frame of it (v: the view state from landing.js)
     drawCloud(ctx, E, k, t, o)               the cloud deck, k 0..1 through it; ghost(ctx, E, x, y, k, t) the shuttle in it;
                                              cloudWisps(ctx, E, t, k) its faster wisps in front; mute(ramp, k) a warm colour cooled
     dissolve(ctx, canvas, k)                 canvas over ctx in the Bayer dither, k 0..1
     shuttle(ctx, d, x, y, Ls, o)             our shuttle (LanderGame's, copied); o: { cabin, rim, lean, fold, broken }
     podAt(d, side, o) → [dx, dy]             a thruster's nozzle from the shuttle's (x, y)
     plume(f, x, y, d, k, sputter)            a thruster's flame, the drive's blue; it sputters on the last of the fuel
     drawHeat(f, x, y, heat, t, ramp, o)      the bow of hot air round the leading underside, in the air's own cold colour
*/
(function () {
    'use strict';
    const P = window.NSPaint, WORLDS = window.NSWorlds, SKY = window.NSSky, SKY2 = window.NSSky2, N = window.MiniPaint;
    if (!P) { console.error('Landing: NSPaint must load first'); return; }
    const { INK, RP, ramp, threshold, clamp01, smooth, lerp, fbm, hash, norm3 } = P;
    const FW = 640, FH = 360, TOWER_W = 0;                                 // GAME: no tower (a stop hides the bridge's #ns-ship): the fall fills the frame
    const ORBIT = Object.freeze({ x: 392, y: 140, r: 87 });
    const LW = norm3(0.42, -0.36, 0.83);                                  // the bridge glass's light (Glass.js LW)
    const LIGHT = Object.freeze([586, 50]);                               // the false sun, small, up and to the right
    const MAX_REACH = 1.8;                                                // the farthest a world's ring or moon reaches (Worlds.js REACH)

    // ── the idle queue: heavy paintings a few milliseconds at a time ──
    // hi: what the next few seconds need (globes, the way down, the chosen find's ground); lo: the rest; bg: only when
    // nothing else waits (the tower's people, painted ahead). soon: true → hi, 'bg' → bg, else lo.
    const hi = [], lo = [], bg = [];
    function later(fn, tag, soon, label) { (soon === 'bg' ? bg : soon ? hi : lo).push({ fn, tag: tag || '', label: label || '' }); }
    const slow = [];                                                      // jobs over 12 ms (for the frame-time checks)
    let jobLog = null;
    let lastTag = '';
    const next = () => (hi.length ? hi : lo.length ? lo : bg);
    const BG_MS = 2;                                                      // the background's share of a frame: a little, every frame, never a burst
    function idle(ms, onlyInBudget, onlyTag) {
        const t0 = performance.now();
        let n = 0, bgUsed = 0;
        while ((hi.length || lo.length || bg.length) && ((n === 0 && !onlyInBudget) || performance.now() - t0 < ms)) {
            let q = next(), at = 0;
            if (onlyTag != null) { const ok = onlyTag instanceof Set ? j => onlyTag.has(j.tag) : j => j.tag === onlyTag; at = hi.findIndex(ok); q = hi; if (at < 0) { at = lo.findIndex(ok); q = lo; } if (at < 0) break; }   // (the final fix round: a Set of tags too)   // (the polish round: in the fall, only the fall's own bakes)
            if (q === bg && bgUsed >= BG_MS) break;
            const job = q.splice(at, 1)[0], j0 = performance.now(); n++; lastTag = job.tag;
            try { job.fn(); } catch (e) { console.error('Landing: a painting step failed', e); }
            const took = performance.now() - j0;
            if (q === bg) bgUsed += took;
            if (took > 12 && slow.length < 200) slow.push({ tag: job.tag, label: job.label, ms: +took.toFixed(1), at: Math.round(j0) });
            if (jobLog && jobLog.length < 3000) jobLog.push([Math.round(j0), +took.toFixed(1), job.tag, job.label]);   // (the polish round, test only: every job, when asked)
        }
        return n;
    }
    function drop(tag) { [hi, lo, bg].forEach(q => { for (let i = q.length - 1; i >= 0; i--) if (q[i].tag === tag) q.splice(i, 1); }); }
    /** Everything queued under tag moves up to the end of the hi queue, in its order (the find you are about to land on). */
    /** The polish round: everything queued under tag goes back from the hi queue to the end of the lo one, in its order
        (behind everything the new next landing still has to queue there). */
    function demote(tag) { const back = []; for (let i = hi.length - 1; i >= 0; i--) if (hi[i].tag === tag) back.unshift(hi.splice(i, 1)[0]); back.forEach(j => lo.push(j)); }
    function promote(tag) { const keep = []; for (let i = 0; i < lo.length; i++) if (lo[i].tag === tag) hi.push(lo[i]); else keep.push(lo[i]); lo.length = 0; keep.forEach(j => lo.push(j)); }
    const pending = tag => (tag == null ? hi.length + lo.length : hi.concat(lo, bg).filter(j => j.tag === tag).length);

    /** A picture painted in strips of rows by the idle queue: paint(p, y0) paints rows y0.. into p (a painter that many rows high).
        rows: a multiple of 8 (the Bayer grain runs on across strips); by default fewer rows the wider the picture. */
    function stripBake(w, h, paint, tag, soon, rows, keepCpu) {
        const STRIP = rows || (w > 400 ? 8 : w > 200 ? 16 : 24);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const out = { canvas: c, g: c.getContext('2d'), done: false, cpu: keepCpu ? new Uint8ClampedArray(w * h * 4) : null };   // cpu: its pixels kept to read (never read back from the canvas)
        for (let y0 = 0; y0 < h; y0 += STRIP) later(() => {
            const n = Math.min(STRIP, h - y0), p = P.painter(w, n, false);
            paint(p, y0);
            out.g.putImageData(new ImageData(p.data, p.W, p.H), 0, y0);
            if (out.cpu) out.cpu.set(p.data, y0 * w * 4);
        }, tag, soon);
        later(() => { out.done = true; }, tag, soon);
        return out;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 1. Orbit: the sector's far sky and the world at the glass framing
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const skies = new Map();
    function orbitSky(sector) {
        if (skies.has(sector)) return skies.get(sector);
        let sky = null;
        try { sky = SKY2 ? SKY2.build(FW, FH, 0, 0, sector, LIGHT.slice(), 'f') : null; } catch (e) { console.warn('Landing: no far sky', e); }
        const strip = P.spaceStrip(FW + 4, FH, 23 + sector * 11, 0.32, sky ? sky.haze : 1, 1), lit = new Float32Array(FW * FH);
        for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) lit[y * FW + x] = 0.25 + 0.75 * Math.exp(-Math.hypot(x - LIGHT[0], (y - LIGHT[1]) * 1.15) / 80);
        const p = P.painter(FW, FH, true), keep = (x, y) => Math.hypot(x - LIGHT[0], y - LIGHT[1]) < 16;
        let bright;
        try { bright = sky && SKY ? SKY.paintSpace(p, strip, 0, lit, keep, sky, 0) : P.paintSpace(p, strip, 0, lit, keep); } catch (e) { bright = P.paintSpace(p, strip, 0, lit, keep); }
        P.lightGlow(p, LIGHT[0], LIGHT[1], { core: 1.4, halo: 7, strength: 0.8, spikes: 5 });
        const out = { canvas: p.canvas(), stars: P.keepVisible(p, bright), sky };
        skies.set(sector, out);
        return out;
    }
    /** The picture runs on under the tower (one place, no seam); beside the hull it darkens toward the ink in the hull's
        own shadow: a dithered falloff a few px wide, darkest at the hull, never a strip of other sky. Baked once. */
    const SHADE_X = [TOWER_W - 10, TOWER_W + 14];
    let shadeC = null;
    function hullShadow(ctx) {
        if (!shadeC) {
            const w = SHADE_X[1], c = document.createElement('canvas'); c.width = w; c.height = FH;
            const g = c.getContext('2d'), img = g.createImageData(w, FH), d = img.data, ink = P.hexRgb(INK);
            for (let y = 0; y < FH; y++) for (let x = 0; x < w; x++) {
                const k = x < SHADE_X[0] ? 0.92 : 0.92 * Math.pow(1 - (x - SHADE_X[0]) / (SHADE_X[1] - SHADE_X[0]), 1.6);
                if (threshold(x, y) >= k) continue;
                const i = (y * w + x) * 4; d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
            }
            g.putImageData(img, 0, 0);
            shadeC = c;
        }
        ctx.drawImage(shadeC, 0, 0);
    }

    /** The world baked at radius r on its own canvas (centre at half), in strips; NSWorlds as the bridge glass paints it.
        The canvas is sized for the farthest companion (a ring or a moon): WORLDS.reach() cannot see the world's own seed,
        which paint() uses, so it would size the storm world's ring away and cut it off at the canvas edge. */
    const globes = new Map();
    function globe(world, r) {
        const key = world.id + ':' + r;
        if (globes.has(key)) return globes.get(key);
        const size = Math.ceil(r * MAX_REACH * 2 + 8), half = size / 2;
        const o = { type: world.type, seed: world.seed, sector: world.sector, L: world.L || LW, node: world.node || null };   // GAME: the node, so it is the world the glass showed
        const pic = stripBake(size, size, (p, y0) => {
            if (WORLDS) WORLDS.paint(p, Object.assign({ cx: half, cy: half - y0, r }, o));
            else P.sphere(p, { cx: half, cy: half - y0, r, ramp: RP.STONE, L: o.L });
        }, 'globe:' + key, r > 87, null, r === 87);
        const out = Object.assign(pic, { half, r, size });
        globes.set(key, out);
        return out;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 2. The lights: one look per kind of find, the same at every height
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const R = {
        TEAL: ramp(INK, '#062018', '#0e4434', '#1f7a5c', '#5fd0a8', '#c8ffe8'),          // Worlds.js GLOW.aurora: life at night
        ACID: ramp(INK, '#141a06', '#2a3a0c', '#4e6a18', '#8aa83a', '#c8e070'),          // a vent's breath (the toxic air's own)
        SMOKE: ramp(INK, '#14181b', '#262c30', '#3c4448', '#5c666a', '#8a9498'),
        FSMOKE: ramp(INK, '#1c1e22', '#383c42', '#5a5f66', '#81878e', '#aeb2b6'),         // the flare's own smoke: paler, lit from under
        STEAM: ramp(INK, '#0c1a20', '#33606e', '#7fb3c2', '#d6eef4', '#f2fbff'),
        LAMP: ramp(INK, '#13232a', '#284650', '#3d6670', '#9fd8e6', '#e1f6fb'),           // machines: blue-white (RP.UI)
    };
    const BLINK_MS = 1500, MACHINE_MS = 1000, SIGNAL_MS = 1800, FLARE_TICK = 90, GEYSER_MS = 4200;

    /** A warm world can swallow a red or amber point: the ground under it darkens a little, in a soft uneven dither that
        thins out with no edge (never a ring, never a disc). */
    function duskPatch(f, x, y, r) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const q = Math.hypot(dx, dy * 1.25) / r + (P.vnoise((x + dx) / 2.1, (y + dy) / 2.1, 29) - 0.5) * 0.8;
            if (q < 1 && threshold(x + dx + 64, y + dy + 64) < (1 - q) * 0.5) f.px(x + dx, y + dy, INK);
        }
    }
    /** Through air or cloud: a soft bloom in the light's own colour (a: its strength now, its rhythm), brightest at a
        one-pixel core that never goes out (the line waits for this). No ring, no square. */
    let litMin = 0;                                                           // > 0: glows leave out their darkest steps (a light on a lit cloud or ground)
    function glowB(f, cx, cy, rad, rp, peak) {
        if (!litMin) { f.glow(cx, cy, rad, rp, peak); return; }
        for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y) / rad; if (d >= 1) continue; const k = P.level(rp, peak * (1 - d) ** 1.5, cx + x, cy + y); if (k >= litMin) f.px(cx + x, cy + y, rp.hex[k]); }
    }
    function smudge(f, x, y, rp, rad, a) {
        const top = rp.hex.length - 1;
        glowB(f, x, y, rad, rp, rad > 16 ? Math.max(0.3, a * 0.8) : a * 0.7);              // seen through cloud: a wide bloom that always shows
        glowB(f, x, y, Math.max(2, Math.round(rad * 0.32)), rp, Math.min(1, a * 1.15));
        f.px(x, y, rp.hex[a > 0.45 ? top - 1 : Math.max(1, top - 2)]);
        return true;
    }
    /** From orbit: a small bright core and a soft glow in its own colour, falling off fast (a point of light, never a disc);
        nothing round it. On bright ground its darkest steps are left out (they would read as a dark mark, not light).
        In orbit (radK, aK, fall, coreN) the glow is wider, brighter and softer and the core 2 px (3 when chosen), so a find
        reads at a glance; and with groundLum (the globe's own pixels) a glow step shows only where it is brighter than the
        ground under it, so on a bright world there is never a dark ring round a light. */
    let minStep = 1, radK = 1, coreN = 1, aK = 1, fall = 2.2, groundLum = null;
    const ORBIT_LIGHT = { RAD_K: 2.2, A_K: 1.7, FALL: 1.5, LUM_MARGIN: 12 };
    const lumOf = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    function point(f, x, y, rp, rad, a, core) {
        rad = Math.round(rad * radK); a *= aK;
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
            const d = Math.hypot(dx, dy) / rad; if (d >= 1 || (dx === 0 && dy === 0)) continue;
            const k = P.level(rp, a * Math.pow(1 - d, fall), x + dx, y + dy);
            if (k < Math.max(minStep, litMin)) continue;
            if (groundLum && lumOf(rp.rgb[k]) <= groundLum(x + dx, y + dy) + ORBIT_LIGHT.LUM_MARGIN) continue;
            f.px(x + dx, y + dy, rp.hex[k]);
        }
        f.px(x - (coreN >> 1), y - (coreN >> 1), core, coreN, coreN);
        return true;
    }
    const WARM_KINDS = { wreck: 1, flare: 1, colony: 1, signal: 1, devil: 1 };
    /** A find's light on the globe, by its colour and rhythm alone. o: { night, pre, burn, chosen (a little brighter),
        warm (the ground there is warm: it darkens a little under a red or amber light) }. */
    function orbitLight(f, kind, x, y, t, o) {
        minStep = o.warm ? 2 : 1; radK = ORBIT_LIGHT.RAD_K; aK = ORBIT_LIGHT.A_K; fall = ORBIT_LIGHT.FALL; coreN = o.chosen ? 3 : 2; groundLum = o.groundLum || null;
        try { return orbitLight1(f, kind, x, y, t, o); } finally { minStep = 1; radK = 1; aK = 1; fall = 2.2; coreN = 1; groundLum = null; }
    }
    function orbitLight1(f, kind, x, y, t, o) {
        const lift = o.chosen ? 1.3 : 1, up = o.chosen ? 1 : 0;
        if (o.warm && WARM_KINDS[kind]) duskPatch(f, x, y, 5);
        if (kind === 'wreck') { const ph = Math.floor((t % BLINK_MS) / 125), s = ph < 2 ? 0 : ph < 4 ? 1 : 2; return point(f, x, y, RP.RED, [5, 4, 3][s] + up, [0.8, 0.55, 0.32][s] * lift, RP.RED.hex[s === 2 ? 3 : 4]); }
        if (kind === 'flare') {
            if (o.pre) return point(f, x, y, RP.RED, 3 + up, 0.5 * lift, RP.RED.hex[3]);
            if (o.burn != null && o.burn <= 0) return false;
            const k = 0.78 + 0.22 * hash(Math.floor(t / FLARE_TICK) & 255, 3, 41);
            return point(f, x, y, RP.RED, 4 + up + (k > 0.9 ? 1 : 0), 0.75 * k * lift, RP.RED.hex[4]);
        }
        if (kind === 'colony') return point(f, x, y, RP.AMBER, 4 + up, 0.42 * lift, RP.AMBER.hex[4]);
        if (kind === 'signal') { const q = (t % SIGNAL_MS) / SIGNAL_MS, flash = q < 0.09; return point(f, x, y, RP.AMBER, (flash ? 5 : 3) + up, (flash ? 0.7 : 0.4) * lift, RP.AMBER.hex[flash ? 4 : 3]); }
        if (kind === 'life') {
            if (!o.night) { duskPatch(f, x + Math.round(Math.sin(t / 2600) * 2), y, 3); return point(f, x, y, R.TEAL, 3 + up, 0.3 * lift, R.TEAL.hex[3]); }   // by day: a dark patch that moves, and a faint glint so it can be found
            const b = 0.5 + 0.5 * Math.sin(t / 1300);
            return point(f, x, y, R.TEAL, Math.round(3 + 2 * b) + up, (0.28 + 0.3 * b) * lift, R.TEAL.hex[b > 0.6 ? 4 : 3]);
        }
        if (kind === 'machines') { const on = (t % MACHINE_MS) < 140; return point(f, x, y, R.LAMP, (on ? 4 : 3) + up, (on ? 0.6 : 0.3) * lift, R.LAMP.hex[on ? 5 : 3]); }
        if (kind === 'geyser') { const q = (t % GEYSER_MS) / GEYSER_MS, jet = q < 0.3 ? 1 : 0; return point(f, x, y, R.STEAM, 3 + up + jet, (0.38 + 0.3 * jet) * lift, R.STEAM.hex[jet ? 5 : 4]); }
        const rp = kind === 'vent' ? R.ACID : kind === 'smoke' ? R.SMOKE : kind === 'devil' ? RP.DUST : null;
        if (!rp) return false;
        const pulse = kind === 'vent' ? 0.5 + 0.5 * Math.sin(t / 1400) : kind === 'devil' ? 0.6 + 0.4 * Math.sin(t / 300) : 0.8;
        return point(f, x, y, rp, 3 + up, (0.28 + 0.16 * pulse) * lift, rp.hex[3]);
    }
    /** Smoke as puffs: they grow and thin as they rise and curl downwind; uneven, never a line. h: the plume's height. */
    function puffs(f, x, y, t, o) {
        const n = o.n, H = o.h, wind = o.wind || 0, rp = o.ramp || R.SMOKE, big = o.big || 1;
        for (let i = 0; i < n; i++) {
            const jit = hash(i, 11, 5), age = ((t / 1000) * o.rate + i / n + jit * 0.37) % 1, h = age * H;
            const px = x + wind * h * (0.35 + age * 0.9) + Math.sin(t / 650 + i * 2.1) * (0.5 + age * 1.6) * big;
            const r = (0.6 + 1.6 * age) * big, a = (o.a || 0.7) * (1 - age) * (0.75 + 0.25 * jit);
            if (r < 1.1) f.tone(px, y - h, rp, a + 0.15);
            else f.glow(Math.round(px), Math.round(y - h), Math.round(r), rp, a);
        }
    }

    /** The light of a find at art (x, y). Small and the same everywhere: the eye learns it once, in orbit.
        o.cloud 0..1: seen through air or cloud (a wider, dimmer smudge in the same colour and rhythm); o.scale: the rings'
        and plumes' reach (1 in orbit, about 3 on the ground); o.wind: which way smoke leans; o.out: the light is dead.
        Returns true when something of it is on screen this frame (the "There's the light." line waits for that). */
    function drawLight(f, kind, x, y, t, o) {
        o = o || {};
        x = Math.round(x); y = Math.round(y);
        const cl = clamp01(o.cloud || 0), sc = o.scale || 1, wind = o.wind || 0;
        if (o.out || kind === 'none' || !kind) return false;
        if (o.lit) { litMin = 2; try { return drawLight(f, kind, x, y, t, Object.assign({}, o, { lit: false })); } finally { litMin = 0; } }   // on a lit surface: no dark steps
        if (o.orbit) return orbitLight(f, kind, x, y, t, o);
        if (o.beat) { const rp = { wreck: RP.RED, flare: RP.RED, colony: RP.AMBER, signal: RP.AMBER, life: R.TEAL, machines: R.LAMP, geyser: R.STEAM, vent: R.ACID, smoke: R.SMOKE, devil: RP.DUST }[kind]; if (rp) glowB(f, x, y, Math.round(14 + 10 * o.beat), rp, 0.3 * o.beat); }   // it slides in under us: a beat brighter
        if (kind === 'wreck') {                                                       // our own ship's beacon (Glass.js): three steps a 1.5 s
            const ph = Math.floor((t % BLINK_MS) / 125);
            if (cl > 0) return smudge(f, x, y, RP.RED, Math.round(9 + 15 * cl), (ph < 2 ? 0.8 : ph < 4 ? 0.5 : 0.22) * (1 - 0.3 * cl));
            if (ph < 2) { glowB(f, x, y, 8, RP.RED, 0.95); f.px(x - 1, y - 1, RP.RED.hex[4], 3, 3); }
            else if (ph < 4) { glowB(f, x, y, 5, RP.RED, 0.7); f.px(x, y, RP.RED.hex[4], 2, 2); }
            else { glowB(f, x, y, 3, RP.RED, 0.42); f.px(x, y, RP.RED.hex[3], 2, 2); }                // between blinks it never goes dark
            return true;
        }
        if (kind === 'flare') {                                                       // A.U.R.A.'s flare: it burns, it never blinks
            if (o.pre) { glowB(f, x, y, 4, RP.RED, 0.5); f.px(x, y, RP.RED.hex[3], 2, 2); f.px(x - 1, y, RP.RED.hex[2], 1, 2); f.px(x + 2, y, RP.RED.hex[2], 1, 2); return true; }
            const k = 0.78 + 0.22 * hash(Math.floor(t / FLARE_TICK) & 255, 3, 41), burn = o.burn == null ? 1 : o.burn;
            if (burn <= 0) return false;
            if (cl > 0) return smudge(f, x, y, RP.RED, Math.round(12 + 18 * cl), 0.62 * k * burn * (1 - 0.3 * cl));
            if (sc > 1) {                                                             // on the ground: a stick in the dirt, its burning head, smoke leaning off it
                const u = Math.max(1, Math.round(sc / 3)), lean = wind || 1;
                puffs(f, x + u, y - 2 * u, t, { n: Math.round(7 + sc * 1.6), h: Math.min(16 * sc, 70), rate: 0.26, wind: wind * 1.6 + 0.25 * lean, big: Math.min(1.6, sc / 3), a: 0.85 * burn, ramp: R.FSMOKE });
                for (let i = 1; i <= 3 * u; i++) f.px(x - Math.round(i * 0.4 * lean), y + i, i < u + 1 ? RP.HULL.hex[2] : RP.HULL.hex[1], u, 1);   // the stick
                glowB(f, x, y, Math.round(4 + 2 * k) * u, RP.RED, 0.7 * k * burn);
                f.px(x - (u >> 1), y - (u >> 1), RP.RED.hex[4], u + 1, u);
                if (burn > 0.4 && k > 0.86) f.px(x, y - (u >> 1), '#ffd2c8', u, u);   // the white-hot core, only on its brightest flickers
                for (let i = 0; i < 3; i++) { const age = ((t / 700) + hash(i, 5, 41)) % 1; if (age < 0.6) f.tone(x + Math.round((hash(i, 7, 41) - 0.5) * 4 * u + lean * age * 3 * u), y - Math.round(age * 9 * u), RP.RED, 0.85 - age, 1, 1); }   // sparks
                return true;
            }
            glowB(f, x, y, Math.round(6 + 2 * k), RP.RED, 0.85 * k * burn);
            f.px(x, y, burn > 0.4 && k > 0.86 ? '#ffd2c8' : RP.RED.hex[4]); f.px(x - 1, y, RP.RED.hex[3]); f.px(x + 1, y, RP.RED.hex[3]);
            return true;
        }
        if (kind === 'colony') {                                                      // their windows: warm and steady
            if (cl > 0) return smudge(f, x, y, RP.AMBER, Math.round(7 + 9 * cl), 0.45 * (1 - 0.35 * cl));
            glowB(f, x + 1, y, 5, RP.AMBER, 0.45);
            f.px(x - 2, y, RP.AMBER.hex[3]); f.px(x, y, RP.AMBER.hex[4], 2, 1); f.px(x + 3, y, RP.AMBER.hex[3]);
            return true;
        }
        if (kind === 'signal') {                                                      // an old beacon: amber, its signal going out in rings
            const q = (t % SIGNAL_MS) / SIGNAL_MS, flash = q < 0.09;
            if (cl > 0) return smudge(f, x, y, RP.AMBER, Math.round(6 + 9 * cl), (flash ? 0.7 : 0.45) * (1 - 0.3 * cl));
            if (sc > 1) { const lm = litMin; litMin = 2; glowB(f, x, y, Math.round((flash ? 3.4 : 2.2) * sc), RP.AMBER, flash ? 0.95 : 0.6); litMin = lm; }   // on the ground: its lamp on the mast never goes dark
            glowB(f, x, y, flash ? 6 : 4, RP.AMBER, flash ? 0.95 : 0.55);
            f.px(x, y, flash ? '#fff3dc' : RP.AMBER.hex[3], 2, 2);
            [0, 0.33].forEach(lag => {
                const k = q - lag; if (k <= 0 || k > 0.6) return;
                const rad = 3 + (k / 0.6) * 7 * sc, fade = 1 - k / 0.6;
                for (let a = Math.PI * 1.05; a < Math.PI * 1.95; a += 0.9 / rad) f.tone(x + 1 + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.8, RP.AMBER, 0.5 * fade);
            });
            return true;
        }
        if (kind === 'life') {                                                        // no flare: a patch that breathes at night, moves by day
            if (!o.night) {
                if (cl > 0) return false;                                             // a dark patch cannot show through air or cloud
                const dx = Math.round(Math.sin(t / 2600) * 2 * sc);
                f.px(x - 2 + dx, y, INK, 5, 1); f.px(x - 1 + dx, y - 1, INK, 3, 1); f.px(x - 3 + dx, y + 1, '#0a1317', 7, 1);
                return true;
            }
            const b = 0.5 + 0.5 * Math.sin(t / 1300);
            if (cl > 0) return smudge(f, x, y, R.TEAL, Math.round(7 + 8 * cl), (0.25 + 0.2 * b) * (1 - 0.3 * cl));
            glowB(f, x, y, Math.round(4 + 2 * b), R.TEAL, 0.35 + 0.3 * b);
            f.px(x - 1, y, R.TEAL.hex[3], 3, 1); if (b > 0.6) f.px(x, y, R.TEAL.hex[4]);
            return true;
        }
        if (kind === 'machines') {                                                    // blue-white, exactly once a second, in step; dim between
            const on = (t % MACHINE_MS) < 140;
            if (cl > 0) return smudge(f, x, y, R.LAMP, Math.round(6 + 8 * cl), (on ? 0.7 : 0.38) * (1 - 0.2 * cl));
            if (o.post) {                                                             // on the ground: one 2 x 2 head on each post, its own glow
                const u = Math.max(2, Math.round(sc / 1.5));
                if (on) glowB(f, x, y, Math.round(3 * u), R.LAMP, 0.75); else glowB(f, x, y, Math.round(1.5 * u), R.LAMP, 0.3);
                f.px(x - (u >> 1), y - (u >> 1), on ? '#e1f6fb' : R.LAMP.hex[3], u, u);
                return true;
            }
            glowB(f, x + 1, y, on ? 5 : 3, R.LAMP, on ? 0.65 : 0.38);
            [-3, 0, 3].forEach(dx => f.px(x + dx, y, on ? '#e1f6fb' : R.LAMP.hex[4], 2, 1));
            return true;
        }
        if (kind === 'geyser') {                                                      // ice: a white jet every few seconds, a breath of steam between
            const q = (t % GEYSER_MS) / GEYSER_MS, up = q < 0.36 ? smooth(0, 0.08, q) * (1 - smooth(0.24, 0.36, q)) : 0;
            if (cl > 0) { smudge(f, x, y, R.STEAM, Math.round(6 + 6 * cl), 0.55 + 0.3 * up); for (let k = 1; k <= Math.round(up * 4); k++) f.px(x, y - k, R.STEAM.hex[4], 1, 1); return true; }
            if (sc <= 1) { glowB(f, x, y, 4, R.STEAM, 0.55); f.px(x - 1, y, R.STEAM.hex[4], 1, 1); f.px(x + 2, y, R.STEAM.hex[4], 1, 1); }   // from orbit: a pale spot in its dark ring
            else { const br = 0.5 + 0.5 * Math.sin(t / 900), lm = litMin; litMin = 2; glowB(f, x + 1, y - Math.round(sc), Math.round(2.6 * sc), R.STEAM, 0.42 + 0.22 * br + 0.3 * up); litMin = lm; }   // on the ground: the vent's cold light, breathing, so it reads from up high
            f.px(x, y, R.STEAM.hex[sc <= 1 ? 5 : 3], 2, 1);
            puffs(f, x + 1, y - 1, t, { n: Math.round(3 + sc), h: 3 * sc, rate: 0.5, ramp: R.STEAM, wind: wind * 0.4, a: 0.55, big: Math.min(1.2, sc / 4) });
            const h = Math.round(up * 8 * sc);
            for (let k = 0; k < h; k++) f.px(x + (k > h * 0.6 ? Math.round(Math.sin(t / 200 + k)) : 0), y - 1 - k, R.STEAM.hex[k > h * 0.7 ? 3 : 4], k > h * 0.5 && sc > 1.5 ? 2 : 1, 1);
            return true;
        }
        if (kind === 'vent' || kind === 'smoke' || kind === 'devil') {                // the world's own sign, slow
            const rp = kind === 'vent' ? R.ACID : kind === 'smoke' ? R.SMOKE : RP.DUST;
            if (cl > 0) {                                                             // through cloud: a dim smudge in its own colour and rhythm
                const pulse = kind === 'vent' ? 0.5 + 0.5 * Math.sin(t / 1400) : kind === 'devil' ? 0.6 + 0.4 * Math.sin(t / 300) : 0.8;
                const dx = kind === 'devil' ? Math.round(Math.sin(t / 900) * 3) : 0;
                return smudge(f, x + dx, y, rp, Math.round(6 + 7 * cl), (0.3 + 0.2 * pulse) * (1 - 0.25 * cl));
            }
            if (sc <= 1) glowB(f, x, y, 3, rp, 0.45);
            f.px(x, y, rp.hex[3], 2, 1);
            if (kind === 'devil') {
                const n = Math.round(6 * sc);
                for (let i = 0; i < n; i++) {
                    const age = ((t / 1000) * 0.9 + i / n) % 1, h = age * 8 * sc, sway = Math.sin(t / 160 + age * 9) * (1 + age * 2.4) * Math.min(1, sc);
                    f.tone(x + 1 + sway, y - 1 - h, rp, 0.7 - age * 0.55, age > 0.5 && sc > 1.5 ? 2 : 1, 1);
                }
            } else puffs(f, x + 1, y - 1, t, { n: Math.round(4 + sc), h: Math.min(8 * sc, 30), rate: 0.25, ramp: rp, wind, a: 0.6, big: Math.min(1.4, sc / 3.4) });
            return true;
        }
        return false;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. The long way down: the planet's limb, its air, the cloud sea below us, side-on
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const LIMB_R = 1150, LIMB_X = 380, LIMB_TOP = 210, LIMB_H = FH + 90;     // the limb canvas: horizon at LIMB_TOP, slides up 70
    const SEA_W = 960, SEA = [{ y: 0, h: 34, speed: 0.12, scale: 0.35, haze: 0.5 }, { y: 30, h: 84, speed: 0.3, scale: 0.6, haze: 0.25 }, { y: 70, h: 132, speed: 0.75, scale: 1, haze: 0 },
        { y: 118, h: 176, speed: 1.35, scale: 1.7, haze: 0 }, { y: 165, h: 230, speed: 2.4, scale: 2.9, haze: 0 }];   // the meteor: two nearer bands, their billows big (the sea we fall into grows as we near it)
    const horizonAt = x => LIMB_TOP + 1 + LIMB_R - Math.sqrt(LIMB_R * LIMB_R - (x - LIMB_X) * (x - LIMB_X));
    const TINTS = [0.1, 0.2, 0.32, 0.46];                                    // the upper sky takes the air's colour as we go deeper
    const HAZE_UP = 40, HAZE_DOWN = 70;                                      // the haze band round the horizon (rows above, below)
    const isWarm = rp => { const c = rp.rgb[Math.min(rp.rgb.length - 1, 3)]; return c[0] > c[2] + 18; };
    const hexOf = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    /** A warm or strong air, cloud or ground seen in the dark: the same hue, desaturated, cooled toward blue and a step
        darker, so a red or amber light still reads on it. The orbit's orange becomes a dim rust, the poison's lime a dirty
        olive, the desert's dust a grey-brown: each world keeps its own colour family from orbit to the ground. k: how much. */
    function mute(rp, k) {
        k = k == null ? 1 : k;
        const s = 1 - 0.55 * k, dk = 1 - 0.2 * k;
        return ramp(...rp.rgb.map((c, i) => {
            if (i === 0) return rp.hex[0];
            const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
            return hexOf([(l + (c[0] - l) * s) * dk - 3 * k, (l + (c[1] - l) * s) * dk, (l + (c[2] - l) * s) * dk + 9 * k]);
        }));
    }

    /** The entry's still layers for one world: the limb (the world itself, huge, at the edge of its air), three bands of
        cloud sea (near to far, each a wide strip that repeats sideways), the haze round the horizon (the night's air-glow
        line in it), the sky's tints, and the cloud deck. S: LanderScene.look of this world (its cloud, air). */
    const entries = new Map();
    function entry(world, S) {
        const key = world.id + ':' + (world.night ? 'n' : 'd');
        if (entries.has(key)) return entries.get(key);
        // the limb is the world's equator seen edge-on: painted on its side (the disc's right edge) and turned a quarter
        // round, so the horizon is the equator, not a pole. Lf: the light in the frame; Lp: the same light on the side.
        const Lf = world.night ? [0.35, -0.6, -0.35] : [0.55, -0.75, 0.35], L = norm3(-Lf[1], Lf[0], Lf[2]);   // night: lit from beyond the limb, only its air glows
        const E = { key, world, S, done: false, air: world.atm > 0, layers: [], night: !!world.night, tints: [] }, tagE = 'entry:' + key;   // (the polish round: tagged by world)
        E.tag = tagE;
        const edge = LIMB_H - 1 - LIMB_TOP, twin = ringlessTwin(world), side = stripBake(LIMB_H, FW, (p, y0) => {
            const o = { cx: edge - LIMB_R, cy: LIMB_X - y0, r: LIMB_R, type: world.type, seed: world.seed, node: twin, sector: world.sector, L, dim: world.night ? 0.3 : world.atm > 0 ? 0.5 : 0.85 };   // seen through its air, the ground below is dim
            if (WORLDS) WORLDS.paint(p, o); else P.sphere(p, { cx: o.cx, cy: o.cy, r: o.r, ramp: RP.STONE, L });
        }, tagE, true);
        const lc = document.createElement('canvas'); lc.width = FW; lc.height = LIMB_H;
        E.limb = { canvas: lc, done: false };
        later(() => { const g = lc.getContext('2d'); g.save(); g.translate(0, LIMB_H); g.rotate(-Math.PI / 2); g.drawImage(side.canvas, 0, 0); g.restore(); E.limb.done = true; }, tagE, true);
        if (E.air) {
            // the world's own cloud and air (a warm or strong one already muted by the ground's look: landing-ground.js), so
            // the entry is the same colour family as the sky it opens onto under the cloud
            const cloud = (S && S.cloud) || mute(RP.DUST), airR = (S && S.airRamp) || RP.ICE, thin = world.atm < 0.6, seed = world.seed + 17, night = world.night ? 0.7 : 1;
            E.cloud = cloud; E.airR = airR;
            E.deckRamp = cloud;
            E.day = !world.night;
            SEA.forEach((band, i) => E.layers.push(Object.assign(seaBand(band, i, cloud, airR, thin, seed, night, tagE), band)));
            E.depth = stripBake(FW, LIMB_H - LIMB_TOP - DEPTH_FROM, paintDepth, tagE, true);
            E.haze = stripBake(FW, HAZE_UP + HAZE_DOWN, (p, y0) => paintHaze(p, y0, airR, E.night, world.atm), tagE, true);
            TINTS.forEach((cov, i) => E.tints.push(stripBake(FW, LIMB_TOP + 34, (p, y0) => paintTint(p, y0, airR, cov, i), tagE, true)));
            E.deck = null; E.sunLit = null;                                       // the meteor: its own deck (meteor-art.js); the old one is never baked
        }
        later(() => { E.done = true; }, tagE, true);
        entries.set(key, E);
        if (entries.size > 3) { const old = entries.keys().next().value; if (old !== key) entries.delete(old); }   // the decks are big: keep the last few
        return E;
    }
    /** One band of the cloud sea: billows lit along their crests, darker below, textured inside; the far bands hazier.
        Thin air tears it into patches with dithered edges, the ground showing between. */
    function seaBand(band, i, cloud, airR, thin, seed, night, tag) {
        const sc = band.scale, s0 = seed + i * 7;
        const wrap = (x, y, s, fx, fy) => { const a = fbm(x / (fx * sc), y / (fy * sc), s, 3), b = fbm((x - SEA_W) / (fx * sc), y / (fy * sc), s, 3); return 0.5 + ((a * (SEA_W - x) + b * x) / SEA_W - 0.5) * 1.45; };
        return stripBake(SEA_W, band.h + 24, (p, y0) => {
            for (let x = 0; x < SEA_W; x++) {
                const n = wrap(x, 3, s0, 90, 22), m = wrap(x, 40, s0 + 3, 90, 22);   // the billows' line, then their bodies
                const top = 18 - 15 * smooth(0.35, 0.8, n) - 5 * (m - 0.5);
                for (let y = 0; y < p.H; y++) {
                    const ay = y + y0;
                    if (ay < top) continue;
                    const d = ay - top, body = wrap(x, ay, s0 + 9, 90, 22), fine = wrap(x, ay, s0 + 13, 22, 6);
                    if (thin && d > 2) {                                                 // thin air: torn into patches, soft at their edges
                        const k = (body - 0.44) / 0.07;
                        if (k < 1 && k < threshold(x, ay) * 1.1) continue;
                    }
                    const above = thin ? wrap(x, ay - 2, s0 + 9, 90, 22) : 1, crest = d < 1.2 || (thin && above < 0.44 && body >= 0.44);
                    const lit = clamp01(0.55 - d / (band.h * 0.75) + (body - 0.5) * 0.75 + (fine - 0.5) * 0.4);
                    if (crest) { const top = airR.hex.length - 1, cv = lerp((0.32 + 0.16 * lit) * night, 0.24 * night, band.haze); p.solid(x, y, airR, Math.round(cv * top) / top); continue; }   // lit crests: the air's own light along the tops (the polish round: on a whole step and hazed with distance: never a dotted line on the horizon)
                    let v = (0.08 + 0.42 * lit + (d < 3 ? 0.06 : 0)) * night * (0.7 + 0.3 * sc);
                    v = lerp(v, 0.26 * night, band.haze);                                  // far: hazier, lower contrast
                    p.solid(x, y, cloud, v);
                }
            }
        }, tag || 'entry', true);
    }
    /** The haze round the horizon: lighter and hazier toward it, from HAZE_UP rows above to HAZE_DOWN below. At night a
        faint air-glow line on the limb so the horizon still reads. */
    function paintHaze(p, y0, airR, night, atm) {
        const top = airR.hex.length - 1, core = Math.round(0.55 * top) / top, glow = Math.round(0.35 * top) / top;   // on whole steps: solid, no dither dots
        for (let y = 0; y < p.H; y++) for (let x = 0; x < FW; x++) {
            const ay = y + y0 - HAZE_UP + LIMB_TOP, dh = ay - horizonAt(x);
            if (night && dh >= -0.5 && dh < 0.5) { p.solid(x, y, airR, core); continue; }       // the glowing air: one solid row on the limb
            if (night && dh >= -1.5 && dh < -0.5) { p.solid(x, y, airR, threshold(x, ay) < 0.7 ? glow : glow * 0.6); continue; }   // and a dithered row of it above
            if (night && dh >= 0.5 && dh < 2.5) { if (threshold(x, ay) < 0.4) p.solid(x, y, airR, glow * 0.6); continue; }
            const k = dh < 0 ? Math.exp(dh / 12) * 0.7 : Math.exp(-dh / 26);
            const cov = k * (night ? 0.35 : 0.55) * Math.min(1, 0.5 + atm * 0.5) * (0.45 + 1.1 * fbm(x / 9, ay / 2.5, 41, 2));   // (the polish round: in uneven veils, never one even dotted row)
            if (cov > 0.02 && threshold(x, ay) < cov) p.solid(x, y, airR, (dh < 0 ? 0.3 : 0.24) * (night ? 0.6 : 1));
        }
    }
    /** Darker toward the foot of the frame: the near cloud sea in its own shadow (the haze makes the far one lighter). */
    const DEPTH_FROM = 30;
    function paintDepth(p, y0) {
        const span = LIMB_H - LIMB_TOP - DEPTH_FROM;
        for (let y = 0; y < p.H; y++) { const ay = y + y0, k = 0.5 * smooth(0, 1, ay / span); for (let x = 0; x < FW; x++) if (threshold(x, ay + 3) < k) p.set(x, y, [5, 7, 10]); }
    }
    /** The upper sky's tint at one depth: the air's colour over space, thicker toward the horizon (thins the stars out). */
    function paintTint(p, y0, airR, cov, i) {
        for (let y = 0; y < p.H; y++) for (let x = 0; x < FW; x++) {
            const ay = y + y0, below = ay - horizonAt(x) + 34;
            if (below > 34) continue;
            const k = cov * (0.35 + 0.65 * clamp01(ay / LIMB_TOP));
            if (threshold(x, ay) < k) p.solid(x, y, airR, 0.1 + 0.05 * i + 0.1 * clamp01(ay / LIMB_TOP));
        }
    }

    /** A gas world may wear a ring; seen from inside its air, painted at the limb's size, a ring is a broad smear across the
        sky. A world of a type that can have one is painted at the limb from a ringless twin: the same type and light,
        another seed (the limb shows too little of the surface for the pattern to be missed). null: paint it as it is. */
    function ringlessTwin(world) {
        if (!WORLDS || !WORLDS.describe) return null;
        const node = k => ({ id: world.id + ':limb' + k, type: world.type, tags: [] });
        const ringOf = k => WORLDS.describe(node(k), world.sector).companion === 'ring';
        const ks = Array.from({ length: 40 }, (_, k) => k);
        if (!ks.slice(0, 12).some(ringOf)) return null;
        const k = ks.find(q => !ringOf(q));
        return k == null ? null : node(k);
    }

    /** One frame of the way down. v: { z 0..1, scroll (px flown), heat, shake, light: { kind, x, y, night, out } | null,
        hulls: [{ x, y, len, seed, from, to, angle, flip }], streaks: bool, speed, rho }. Returns whether the light showed. */
    function drawEntry(ctx, E, v, t) {
        const f = P.framer(ctx, FW, FH), sh = v.shake ? [Math.round((Math.random() - 0.5) * v.shake * 2), Math.round((Math.random() - 0.5) * v.shake * 2)] : [0, 0];
        ctx.save(); ctx.translate(sh[0], sh[1]);
        const lift = Math.round(70 * v.z);                                       // deeper: the horizon climbs
        if (E.air && E.tints.length) { const i = Math.min(E.tints.length - 1, Math.floor(v.z * (E.tints.length + 0.6)) - 1); if (i >= 0 && E.tints[i].done) ctx.drawImage(E.tints[i].canvas, 0, -lift); }
        if (E.limb.done) ctx.drawImage(E.limb.canvas, 0, -lift);
        if (E.air && E.layers.length) {
            const base = LIMB_TOP - lift, depth = v.z;
            E.layers.forEach((L, i) => {
                if (!L.done) return;
                const y = Math.round(base + 4 + L.y * (0.6 + 0.9 * depth) + (i === 2 ? 40 * (1 - depth) : 0) - 18);
                const off = ((Math.round(v.scroll * L.speed) % SEA_W) + SEA_W) % SEA_W;
                ctx.drawImage(L.canvas, -off, y); ctx.drawImage(L.canvas, SEA_W - off, y);
                if (i === 0 && E.haze && E.haze.done) ctx.drawImage(E.haze.canvas, 0, LIMB_TOP - HAZE_UP - lift);
            });
            if (E.depth && E.depth.done) ctx.drawImage(E.depth.canvas, 0, LIMB_TOP + DEPTH_FROM - lift);
        }
        f.reset();
        let shown = false;
        if (v.light && !v.noLight && v.light.x < FW + 20) shown = drawLight(f, v.light.kind, v.light.x, v.light.y, t, { night: v.light.night, cloud: E.air ? 0.55 : 0, wind: 0, out: v.light.out, burn: v.light.burn, beat: v.light.beat });
        (v.hulls || []).forEach(hu => drawHull(ctx, hu));
        if (v.streaks && E.air) streaks(ctx, v, LIMB_TOP - lift - 6, E);
        ctx.restore();
        return shown;
    }
    /** The air going past: wisps, not lines. Each is a few uneven specks along a slight wave, with gaps, brightest at its
        head, the rest fading back; more and faster the denser and quicker the air. */
    function streaks(ctx, v, top, E) {
        const air = E.airR || RP.ICE, n = Math.round(5 + 18 * clamp01(v.rho)), span = FH - top, hx = air.hex, last = hx.length - 1;
        for (let i = 0; i < n; i++) {
            const sp = 0.6 + hash(i, 7, 3), y0 = top + hash(i, 2, 3) * span, len = 6 + v.speed * 0.16 * sp, lit = clamp01(v.rho) > 0.25 ? 0 : 1;
            const x0 = FW + 20 - ((v.scroll * sp * 2.2 + hash(i, 1, 3) * 900) % (FW + 60)), ph = hash(i, 4, 3) * 6.28;
            for (let s = 0; s < len; s += 1 + hash((i * 7 + Math.round(s)) & 255, 9, 3) * 2.4) {   // uneven steps: gaps between specks
                if (hash((i * 13 + Math.round(s * 3)) & 255, 11, 3) < 0.28) continue;
                const q = s / len, x = Math.round(x0 + s), y = Math.round(y0 + Math.sin(ph + s * 0.35) * 1.2 * q);
                ctx.fillStyle = hx[Math.max(1, last - 1 - lit - Math.round(q * 2.4))];
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    /** A solid one-pixel rim on a sprite's lit edge: every painted pixel whose neighbour toward the light (dx, dy) is empty
        takes the pale colour. Cold or neutral (never the dotted orange of a dithered sun rim). */
    function rimEdge(p, dx, dy, rgb) {
        const W2 = p.W, H2 = p.H, d = p.data, hit = [];
        for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
            if (!d[(y * W2 + x) * 4 + 3]) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W2 || ny >= H2 || !d[(ny * W2 + nx) * 4 + 3]) hit.push(x, y);
        }
        for (let i = 0; i < hit.length; i += 2) p.set(hit[i], hit[i + 1], rgb);
    }
    const PALE = [178, 192, 196], PALE_HULL = [150, 164, 168];
    /** Dead hulls of our class drifting in the air: the living ship's own shape (nose cone, decks, skirt, bell), whole or
        snapped once, grey and rust-streaked, one row of dark deck windows, a cold pale rim on the side the false sun lights.
        Baked once each. */
    const hulls = new Map();
    function drawHull(ctx, hu) {
        const key = [hu.len, hu.seed, hu.from, hu.to, hu.angle, hu.flip].join(':');   // hu.len: already the size on screen (a few sizes: the caller rounds it)
        let c = hulls.get(key);
        if (!c) {
            const size = Math.ceil(hu.len * 1.25) + 10, p = P.painter(size, size, false);
            const o = { x: size / 2, y: size / 2, len: hu.len, ht: hu.len * 0.31, angle: hu.angle, flip: hu.flip, light: 0.66, rust: true, ramp: RP.HULL, seed: hu.seed, from: hu.from, to: hu.to, sun: 0, holes: 0.35 };
            const at = P.hull(p, o, P.shapeL);
            for (let u = Math.max(0.26, hu.from + 0.06); u < Math.min(0.84, hu.to - 0.04); u += 0.045) {   // the deck windows, dark: nobody aboard
                const [wx, wy] = at(u, -0.16), [wx2, wy2] = at(u + 0.014, -0.16);
                p.set(wx, wy, [8, 10, 13]); p.set(wx2, wy2, [8, 10, 13]);
            }
            rimEdge(p, 1, -1, PALE_HULL);
            c = { canvas: p.canvas(), half: size / 2 };
            hulls.set(key, c);
        }
        ctx.drawImage(c.canvas, Math.round(hu.x - c.half), Math.round(hu.y - c.half));
    }

    /** The heat: a bow of glowing air round the leading underside (we fly right and sink), in the air's own cold colour
        (never orange): brighter and wider as it heats, flickering, a cold plasma trail behind, sparks peeling back over 100.
        (x, y): the shuttle's centre. o: { lean } */
    function drawHeat(f, x, y, heat, t, rampH, o) {
        if (heat < 0.05) return;
        const k = clamp01(heat), hot = heat > 1, hx = rampH.hex, top = hx.length - 1, lean = (o && o.lean) || 0;
        const rx = 11 + 6 * k, ry = 15 + 5 * k, th = 1 + Math.round(2.5 * k) + (hot ? 1 : 0), peakA = 0.9 + lean, tick = Math.floor(t / 60);
        f.glow(Math.round(x + Math.cos(peakA) * rx * 0.8), Math.round(y + Math.sin(peakA) * ry * 0.8), Math.round(6 + 8 * k), rampH, 0.25 + 0.45 * k);
        for (let a = -0.9 + lean; a < 2.9 + lean; a += 0.7 / Math.max(rx, ry)) {
            const w = Math.exp(-Math.pow((a - peakA) / 1.05, 2));                        // brightest at the leading underside
            for (let j = 0; j < th; j++) {
                const r = 1 - j * 0.07, px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
                const flick = 0.75 + 0.25 * hash(Math.round(a * 40) & 255, (tick + j) & 255, 9);
                const val = k * w * flick * (1 - j / (th + 1) * 0.6) * (hot ? 1.15 : 1);
                if (val < 0.1) continue;
                f.px(px, py, hx[Math.max(1, Math.min(top, Math.round(val * top)))]);
            }
        }
        const trail = Math.round(14 + 40 * k);                                         // the plasma trail, cold, streaming back
        for (let s = 0; s < 3; s++) {
            const a0 = s === 0 ? -0.6 + lean : s === 1 ? 2.6 + lean : 2.1 + lean, sx = x + Math.cos(a0) * rx, sy = y + Math.sin(a0) * ry;
            for (let i = 0; i < trail * (s === 2 ? 0.6 : 1); i++) {
                const q = i / trail, wob = Math.sin(t / 90 + i * 0.4 + s) * q * 2;
                if (hash(i & 255, (tick + s * 7) & 255, 3) < q * 0.7) continue;
                f.px(sx - i, sy - i * 0.18 + wob, hx[Math.max(1, Math.round((top - 1) * (1 - q) * k))]);
            }
        }
        if (hot) for (let i = 0; i < 12; i++) {                                         // too hot: sparks peel back off the bow
            const age = ((t / 600) + hash(i, 5, 7)) % 1, a = peakA - 0.8 + hash(i, 9, 7) * 1.6;
            const sx = x + Math.cos(a) * rx - age * 70, sy = y + Math.sin(a) * ry - age * 22 + Math.sin(i + t / 120) * 2;
            f.px(sx, sy, hx[top]); f.px(sx - 1, sy, hx[Math.max(1, top - 1)]); if (age < 0.5) f.px(sx - 2, sy, hx[Math.max(1, top - 2)]);
        }
    }

    /** A storm world from above: lightning inside the cloud sea below, a cold flash and a second flicker every few seconds. */
    const BOLT = ramp(INK, '#16222e', '#3c5a78', '#9cc4e8', '#f2fbff');   // Worlds.js GLOW.bolt
    const STORM_EVERY_MS = 3300;
    function stormFlash(f, now, horizon) {
        const n = Math.floor(now / STORM_EVERY_MS), q = now - n * STORM_EVERY_MS;
        if (!(q < 140 || (q > 230 && q < 300))) return;
        const x = TOWER_W + 40 + hash(n & 255, 3, 17) * (FW - TOWER_W - 80), y = horizon + 30 + hash(n & 255, 9, 17) * (FH - horizon - 50);
        f.glow(x, y, q < 140 ? 34 : 22, BOLT, q < 140 ? 0.55 : 0.35);
    }
    /** A lightning cell across the way down: a tower of cloud lit from inside, dim, flickering every second or so with a
        short jagged bolt; struck: a bright flash round the shuttle. (x, y): its heart, at its depth. */
    const CELL_MS = 1150;
    function stormCell(f, x, y, now, struck) {
        x = Math.round(x); y = Math.round(y);
        const n = Math.floor(now / CELL_MS), q = now - n * CELL_MS, on = q < 110 || (q > 180 && q < 230);
        f.glow(x - 3, y - 26, 14, BOLT, 0.22); f.glow(x + 2, y - 12, 18, BOLT, 0.28); f.glow(x, y + 2, 22, BOLT, on ? 0.62 : 0.3);   // a tower of cloud, lit from inside
        if (on) { let bx = x + Math.round((hash(n & 255, 2, 23) - 0.5) * 10), by = y - 16; for (let i = 0; i < 6; i++) { const nx = bx + Math.round((hash((n + i) & 255, 4, 23) - 0.5) * 6), ny = by + 4 + Math.round(hash((n + i) & 255, 6, 23) * 3); for (let k = 0; k <= 4; k++) f.px(Math.round(bx + (nx - bx) * k / 4), Math.round(by + (ny - by) * k / 4), k % 2 ? BOLT.hex[3] : BOLT.hex[4]); bx = nx; by = ny; } }
        if (struck) f.glow(x, y, 34, BOLT, 0.7);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. The cloud deck: baked once per world (a tall dark texture at a few coverages), scrolled up as we sink
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const DECK_H = 760, DECK_FILL = [0.12, 0.3, 0.5, 0.72, 1.0], DECK_B = 4, DECK_UP = 70;   // DECK_UP: px a second the deck rises past us
    function deckBake(E, seed) {
        const rp = E.deckRamp, gw = FW / DECK_B, gh = DECK_H / DECK_B, n = new Float32Array(gw * gh), night = E.night ? 0.55 : 1;
        const out = { levels: DECK_FILL.map(() => { const c = document.createElement('canvas'); c.width = FW; c.height = DECK_H; return { canvas: c, g: c.getContext('2d') }; }), done: false };
        const ROWS = 12;                                                        // a few rows of all five levels a job
        for (let y0 = 0; y0 < DECK_H; y0 += ROWS) later(() => {
            for (let by = Math.floor(y0 / DECK_B); by < Math.min(gh, Math.ceil((y0 + ROWS) / DECK_B)); by++) for (let bx = 0; bx < gw; bx++) n[by * gw + bx] = fbm(bx * DECK_B / 70, by * DECK_B / 34, seed, 3);
            out.levels.forEach((L, li) => {
                const img = L.g.createImageData(FW, ROWS), d = img.data, fill = DECK_FILL[li];
                for (let y = 0; y < ROWS && y0 + y < DECK_H; y++) for (let x = 0; x < FW; x++) {
                    const ay = y0 + y, nn = n[Math.floor(ay / DECK_B) * gw + Math.floor(x / DECK_B)], cover = clamp01((nn - 0.5 + fill * 1.2) * 2.6);
                    if (cover <= 0 || cover < threshold(x, ay)) continue;
                    const v = Math.min(0.5, 0.06 + 0.5 * smooth(0.3, 0.74, nn)) * night, top = rp.rgb.length - 1, pos = v * top, lo = pos | 0, lv = Math.min(top, lo + (pos - lo > threshold(x + 3, ay + 1) ? 1 : 0)), c = rp.rgb[lv];   // billow tops lit to about half
                    const i = (y * FW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
                }
                L.g.putImageData(img, 0, y0);
            });
        }, 'entry', true, 'deck');
        later(() => { out.done = true; }, 'entry', true, 'deck');
        return out;
    }
    const deckLevel = k => Math.min(DECK_FILL.length - 1, Math.round(smooth(0, 0.55, k) * (DECK_FILL.length - 1)));
    const deckScroll = t => Math.round((t / 1000) * DECK_UP) % (DECK_H - FH);
    /** The cloud deck: k 0 just at the tops, 1 deep inside; it rises from below and closes over. The light under it shows
        as a smudge of its own colour. Returns whether the light showed. */
    function drawCloud(ctx, E, k, t, o) {
        const f = P.framer(ctx, FW, FH), dk = E.deck;
        o = o || {};
        if (dk && dk.done) {
            const sy = deckScroll(t), fill = smooth(0, 0.55, k), line = Math.max(0, Math.round(FH * (1 - fill * 1.4) - 40));
            if (line > 0) ctx.drawImage(dk.levels[0].canvas, 0, sy, FW, line, 0, 0, FW, line);
            ctx.drawImage(dk.levels[deckLevel(k)].canvas, 0, sy + line, FW, FH - line, 0, line, FW, FH - line);
            if (E.sunLit && E.sunLit.done) dissolve(ctx, E.sunLit.canvas, 0.85 * (1 - smooth(0.15, 1, k)));   // by day the sun above the deck lights its top
        }
        if (o.lamp) f.glow(o.lamp[0], o.lamp[1], 30, R.LAMP, 0.3);                // the shuttle's own lamp lighting the murk round it
        let shown = false;
        if (o.light) shown = drawLight(f, o.light.kind, o.light.x, o.light.y, t, { night: o.light.night, cloud: 0.7 + 0.3 * k, out: o.light.out, burn: o.light.burn });
        if (o.beam) beam(f, o.beam, t);
        return shown;
    }
    /** Faster wisps of the deck passing in front of everything (the sparse level, scrolled quicker, through a dither). */
    let wispC = null;
    function cloudWisps(ctx, E, t, k) {
        const dk = E.deck;
        if (!dk || !dk.done) return;
        if (!wispC) { wispC = document.createElement('canvas'); wispC.width = FW; wispC.height = FH; }
        const g = wispC.getContext('2d'), sy = Math.round((t / 1000) * DECK_UP * 2.6 + 211) % (DECK_H - FH);
        g.globalCompositeOperation = 'copy'; g.drawImage(dk.levels[1].canvas, 0, sy, FW, FH, 0, 0, FW, FH); g.globalCompositeOperation = 'source-over';
        dissolve(ctx, wispC, 0.22 + 0.2 * k);
    }
    /** The shuttle inside the deck: solid but darkened toward the cloud's colour, wisps of the deck passing in front, its
        warm window the thing that still reads. (x, y) as shuttle(); k 0..1 how deep in. */
    const ghosts = new Map();
    let wisp = null;
    function ghost(ctx, E, x, y, k, t, o) {
        const d = 2, so = Object.assign({ rim: false }, o), S = shuttleSprite(d, 1, so), dk = 0.2 + 0.3 * k, key = sKey(d, 1, so) + ':' + dk.toFixed(1) + ':' + E.key;
        let c = ghosts.get(key);
        if (!c) {
            c = document.createElement('canvas'); c.width = S.canvas.width; c.height = S.canvas.height;
            const g = c.getContext('2d'); g.drawImage(S.canvas, 0, 0);
            g.globalCompositeOperation = 'source-atop'; g.globalAlpha = +dk.toFixed(1); g.fillStyle = (E.deckRamp || RP.DUST).hex[1]; g.fillRect(0, 0, c.width, c.height);
            if (ghosts.size > 24) ghosts.clear();
            ghosts.set(key, c);
        }
        const ax = Math.round(x) - S.ox, ay = Math.round(y) - S.oy;
        ctx.drawImage(c, ax, ay);
        if (E.deck && E.deck.done) {                                             // the deck's own wisps, passing in front of it (a sparse grain of it)
            const sy = deckScroll(t), w = c.width, h = c.height, src = E.deck.levels[DECK_FILL.length - 1].canvas, lvl = Math.round(3 + 4 * k);
            if (!wisp || wisp.c.width < w || wisp.c.height < h) { const wc = document.createElement('canvas'); wc.width = Math.max(w, 64); wc.height = Math.max(h, 96); wisp = { c: wc, g: wc.getContext('2d'), pats: [] }; }
            const g = wisp.g;
            if (!wisp.pats[lvl]) wisp.pats[lvl] = g.createPattern(maskAt(lvl), 'repeat');
            g.globalCompositeOperation = 'copy'; g.drawImage(src, Math.max(0, Math.min(FW - w, ax)), Math.max(0, Math.min(DECK_H - h, sy + ay)), w, h, 0, 0, w, h);
            g.globalCompositeOperation = 'destination-in'; g.fillStyle = wisp.pats[lvl]; g.fillRect(0, 0, w, h);
            g.globalCompositeOperation = 'source-over';
            ctx.drawImage(wisp.c, 0, 0, w, h, ax, ay, w, h);
        }
        ctx.fillStyle = RP.AMBER.hex[3];
        const win = S.win, kk = Math.max(1, Math.round(d * 0.7));
        ctx.fillRect(Math.round(x + win[0] - kk / 2), Math.round(y + win[1]), kk, kk);
    }
    /** The machines' searchlight: a pale shaft up through the cloud that has found us. */
    function beam(f, b) {
        const n = 90, w0 = 2, w1 = 9;
        for (let i = 0; i < n; i++) {
            const q = i / n, x = lerp(b.x0, b.x1, q), y = lerp(b.y0, b.y1, q), w = lerp(w1, w0, q);
            for (let k = -w; k <= w; k++) if (threshold(Math.round(x + k), Math.round(y)) < 0.22 * (1 - Math.abs(k) / (w + 1)) * (0.6 + 0.4 * q)) f.tone(x + k, y, R.LAMP, 0.55);
        }
    }

    // ── a dither dissolve: canvas over ctx where the Bayer threshold is under k (one cached pattern per level) ──
    const masks = [], patterns = [];
    function maskAt(level) {
        if (masks[level]) return masks[level];
        const c = document.createElement('canvas'); c.width = 8; c.height = 8;
        const g = c.getContext('2d'), img = g.createImageData(8, 8);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) img.data[(y * 8 + x) * 4 + 3] = threshold(x, y) < level / 16 ? 255 : 0;
        g.putImageData(img, 0, 0);
        masks[level] = c;
        return c;
    }
    let dis = null;
    function dissolve(ctx, canvas, k) {
        const level = Math.round(clamp01(k) * 16);
        if (level <= 0) return;
        if (level >= 16) { ctx.drawImage(canvas, 0, 0); return; }
        if (!dis) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; dis = { c, g: c.getContext('2d') }; }
        const g = dis.g;
        if (!patterns[level]) patterns[level] = g.createPattern(maskAt(level), 'repeat');
        g.globalCompositeOperation = 'copy'; g.drawImage(canvas, 0, 0);
        g.globalCompositeOperation = 'destination-in'; g.fillStyle = patterns[level]; g.fillRect(0, 0, FW, FH);
        g.globalCompositeOperation = 'source-over';
        ctx.drawImage(dis.c, 0, 0);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 5. Our shuttle (LanderGame.js shuttleSprite, copied: a small copy of our Lander's hull, nose up on four legs)
    //    lean: turned about the bell (+ leans the nose right, into the way we fly); fold 0: legs folded for the entry,
    //    1: down to land; broken: lying wrecked, one leg snapped, no rim; rim: the sun's warm edge (day on the ground only)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const SH = { LEN: 13, BELL: 6.6, PODS: 3.5, POD_Y: 7, PAD: 5.9, FEET: 9, LAMP_Y: -2.7 };
    SH.HT = SH.LEN * 0.31;
    const sprites = new Map();
    const sKey = (d, Ls, o) => [d, Ls, (o.lean || 0).toFixed(2), o.fold == null ? 1 : o.fold, o.rim === true ? 1 : 0, o.broken ? 1 : 0].join(':');
    function rotor(lean) { const c = Math.cos(lean), s = Math.sin(lean); return (x, y) => { const dy = y - SH.BELL; return [x * c - dy * s, SH.BELL + x * s + dy * c]; }; }
    function shuttleSprite(d, Ls, o) {
        o = o || {};
        const key = sKey(d, Ls, o);
        if (sprites.has(key)) return sprites.get(key);
        const lean = o.lean || 0, fold = o.fold == null ? 1 : o.fold, rim = o.rim === true && !o.broken, broken = !!o.broken;
        const K = N || P, RPK = K.RP, m = lean ? Math.ceil(10 * d * Math.min(1, Math.abs(lean))) : 0;
        const half = Math.ceil(7.5 * d) + m, top = Math.ceil((SH.LEN - SH.BELL + 1) * d) + m, bottom = Math.ceil((SH.FEET + 0.5) * d) + m;
        const p = K.painter(half * 2, top + bottom, false), ox = half, oy = top, rot = rotor(lean);
        const at = (x, y) => { const [rx, ry] = rot(x, y); return [ox + rx * d, oy + ry * d]; };
        const leg = (x0, y0, x1, y1, w, v) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * d * 1.5); for (let k = 0; k <= n; k++) { const q = k / n, [ax, ay] = at(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q); for (let i = 0; i < Math.max(1, w * d); i++) p.solid(ax + i - w * d / 2, ay, RPK.HULL, v); } };
        const foot = side => [lerp(side * (SH.HT * 0.5 + 0.5), side * SH.PAD, fold), lerp(SH.BELL + 0.4, SH.FEET - 0.3, fold)];
        if (fold > 0.4) [-1, 1].forEach(side => { if (!(broken && side === -Ls)) leg(side * SH.HT * 0.22, SH.BELL - 1.6, side * (SH.PAD - 2.8) * fold + side * SH.HT * 0.22 * (1 - fold), lerp(SH.BELL, SH.FEET - 0.3, fold), 0.45, 0.2); });
        K.hull(p, { x: ox, y: oy + SH.BELL * d, len: SH.LEN * d, ht: SH.HT * d, angle: Math.PI / 2 + lean, anchor: 1, mirror: Ls < 0, seed: 5, sunDir: null, sun: 0, light: broken ? 0.7 : 1 }, K.shapeL);
        [-1, 1].forEach(side => {
            const lit = side === Ls ? 0.62 : 0.34, snapped = broken && side === -Ls;
            const [fx, fy] = snapped ? [side * (SH.HT * 0.46 + 1.4), SH.BELL + 0.6] : foot(side);   // a snapped leg: a stub, bent out
            leg(side * SH.HT * 0.46, SH.BELL - 2.2, fx, fy, 0.6, lit);
            if (!snapped) { const [px, py] = at(fx - 1, fy - 0.4); for (let y = 0; y < Math.max(1, Math.round(0.7 * d)); y++) for (let x = 0; x < 2 * d; x++) p.solid(px + x, py + y, RPK.HULL, y === 0 ? lit + 0.15 : lit - 0.1); }
            const [bx, by] = at(side * SH.PODS, SH.POD_Y - 1.4);
            for (let y = 0; y < 1.4 * d; y++) { const w = (0.5 + 0.5 * y / (1.4 * d)) * d; for (let x = -w / 2; x < w / 2; x++) p.solid(bx + x, by + y, RPK.HULL, (x * Ls > 0 ? 0.5 : 0.28) + (y > 1.4 * d - 1.5 ? -0.08 : 0)); }
        });
        if (rim) rimEdge(p, Ls, 0, PALE);                                        // standing in direct sun: a solid pale edge on its sun side
        const [wx, wy] = rot(Ls * 0.5, SH.LAMP_Y), S = { canvas: p.canvas(), ox, oy, win: [wx * d, wy * d] };
        if (sprites.size > 160) { let n = 0; for (const k of sprites.keys()) { if (n++ > 50) break; sprites.delete(k); } }   // the meteor turns and zooms: keep the last few
        sprites.set(key, S);
        return S;
    }
    /** The shuttle with its top (the old 13 x 9 box's top) at art (x, y), d art px per world px. o.cabin: its window lit
        warm (people inside); o.alpha: faded; o.lean, o.fold, o.rim, o.broken: as the sprite above. */
    function shuttle(ctx, d, x, y, Ls, o) {
        o = o || {};
        const S = shuttleSprite(d, Ls < 0 ? -1 : 1, o), ax = Math.round(x) - S.ox, ay = Math.round(y) - S.oy;
        if (o.alpha != null) { ctx.save(); ctx.globalAlpha = o.alpha; ctx.drawImage(S.canvas, ax, ay); ctx.restore(); }
        else ctx.drawImage(S.canvas, ax, ay);
        if (o.cabin) {                                                            // the window: lit from inside, warm (people are aboard)
            const k = Math.max(1, Math.min(2, Math.round(d * 0.7))), wx = Math.round(x + S.win[0] - k / 2), wy = Math.round(y + S.win[1]);
            if (d >= 3) { ctx.fillStyle = INK; ctx.fillRect(wx - 1, wy - 1, k + 2, k + 1); }   // close up: a dark slot round a thin warm line
            ctx.fillStyle = o.cabinHot ? RP.AMBER.hex[4] : RP.AMBER.hex[3];
            ctx.fillRect(wx, wy, k, d >= 3 ? 1 : k);
        }
    }
    /** Where a thruster's nozzle is from the shuttle's (x, y) at d, its legs and lean as o. side: -1 left pod, 1 right. */
    function podAt(d, side, o) { const [rx, ry] = rotor((o && o.lean) || 0)(side * SH.PODS, SH.POD_Y - 0.5); return [rx * d, ry * d]; }
    /** A thruster's flame at art (x, y) pointing down: the drive's blue, hot at the nozzle (LanderGame drawPlume). On the
        last of the fuel (sputter 0..1) it coughs: frames missing, shorter, thinner. */
    function plume(f, x, y, d, k, sputter) {
        const sp = sputter || 0, tick = Math.floor(performance.now() / 70);
        if (sp > 0 && hash(tick & 255, Math.round(x) & 255, 13) < sp * 0.55) { f.px(x - d / 2, y, RP.PLUME.hex[2], Math.max(1, d), 1); return; }
        const len = (6 + Math.random() * 4) * d * 0.85 * (k == null ? 1 : k) * (1 - sp * 0.5);
        f.glow(x, y + d, Math.max(1, Math.round(1.8 * d * (1 - sp * 0.4))), RP.PLUME, 0.55);
        for (let i = 0; i < len; i++) {
            const q = i / len, w = Math.max(1, Math.round((1 - q * 0.65) * d * 1.1 * (1 - sp * 0.35) + (q > 0.7 ? Math.random() : 0)));
            for (let j = 0; j < w; j++) f.tone(x - w / 2 + j, y + i, RP.PLUME, (1.05 - q) * (j === 0 || j === w - 1 ? 0.7 : 1));
        }
    }

    /** GAME: a world's globes and its entry let go, with their queued jobs (LandFall.js, when the landing closes or the stop
        is left: up to 2.4 MB a globe size, more for the entry's layers). */
    function forget(worldId) {
        const pre = worldId + ':';
        globes.forEach((g, key) => { if (key.startsWith(pre)) { drop('globe:' + key); globes.delete(key); } });
        entries.forEach((E, key) => { if (key.startsWith(pre)) { drop(E.tag); entries.delete(key); } });
    }
    window.LandingArt = Object.freeze({
        forget,   // GAME
        FW, FH, TOWER_W, ORBIT, LW, LIGHT, SH, R, DECK_UP, ENTRY: Object.freeze({ LIMB_TOP, HAZE_UP, SEA_W, DEPTH_FROM, LIMB_H }), drawHull, shuttleSprite,
        later, idle, drop, pending, stripBake, demote, promote, slow: () => slow.slice(), lastTag: () => lastTag, jobLog: on => { const out = jobLog; jobLog = on ? [] : null; return out; },
        orbitSky, hullShadow, globe, drawLight, puffs, entry, drawEntry, drawHeat, stormFlash, stormCell, drawCloud, cloudWisps, ghost, dissolve, shuttle, podAt, plume, beam, isWarm, mute, rimEdge, promote,
    });
})();
