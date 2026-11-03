/* ═══ Silent Exodus · new screen (?new=1) · land/LandArt.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/landing-art.js (sha1 75fb6c9306c5, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   GAME: no tower (TOWER_W 0); the globe is the glass's world (NSWorlds.paint gets the node, as stop/Glass.js paints it);
   forget(worldId) lets a world's globes and entry go. hullShadow stays exported, unused.
   The split (2026-11-03, the house's 800-line limit): this file is the idle queue, the orbit (the far sky, the globes),
   the lights, the dissolve and our shuttle; LandArtAir.js is the long way down (the limb, the cloud sea, the haze, the
   hulls in the air, the heat, the storm, the old cloud deck) and makes window.LandingArt. The code moved as it was; the
   shared names are window.LandingArtParts (made here). §3-4 below are in LandArtAir.js.
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
    // (the split) the queue's test readings, for LandingArt (LandArtAir.js)
    const slowNow = () => slow.slice(), lastTagNow = () => lastTag, jobLogOn = on => { const out = jobLog; jobLog = on ? [] : null; return out; };
    // (the split) for LandArtAir.js
    window.LandingArtParts = Object.freeze({
        FH, ramp, norm3, FW, WORLDS, P, RP, fbm, smooth, threshold, clamp01, lerp, hash, PALE_HULL, INK, TOWER_W, R, sKey, globes, ORBIT, LW, LIGHT, SH,
        pending, stripBake, later, drawLight, rimEdge, dissolve, shuttleSprite, maskAt, drop, idle, demote, promote, orbitSky, hullShadow, globe, puffs,
        shuttle, podAt, plume, slowNow, lastTagNow, jobLogOn
    });
})();
