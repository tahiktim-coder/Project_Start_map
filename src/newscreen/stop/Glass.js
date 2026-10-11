/* ═══ Silent Exodus · new screen (?new=1) · stop/Glass.js: what the bridge's big window shows ═══════════════════════════
   What it is: the sky behind the glass in orbit: far space with the sector's dust, the light ahead (it grows with every
   world we have passed), the world we came to braking in at eight sizes until it fills most of the window, a red beacon
   on our own wrecks, a slow red blink in the sky while a distress call waits, the shuttle dropping to the site and coming
   home, and the fuel stream pulled up from a gas giant after "Skim fuel".
   Worlds: NSWorlds.paint (art/Worlds.js) when it is loaded, so the world in the glass is the one in the travel view; else
   the sphere recipe with the orbit's colours. A station is drawStation, a field of rocks five small spheres, sector 1's
   giant paintGiant pushed in on its limb, the Structure the light itself, the Wrong Place a dark world.
   Source: prototypes/slice/stop.js §2-3 (backdrop, lightNow, worldPic, worldGeom, siteOf, drawGlass, skimFlow, the
   shuttle), generalised from five fixed places to any real node (docs/BUILD_B.md §2). No randomness: seeds hash the id.
   Loaded only when the new-screen switch is on, after stop/Dive.js.

   window.NSGlass (frozen)
     SW, SH, OFFX, WIN, LIGHT          the frame (640 x 360), the room's x offset, the glass rect and the light, frame px
     place(node, t)                    the world the glass shows now (null: none); its sizes are queued at once
     prepare(node)                     a course is set: bake that world's sizes in the flight's idle frames
     geom(t, shownAt) → { x, y, r, e, kind }   where the world sits now (e: 0..1 braked in), frame px
     settled(t, shownAt) → bool        the world has braked in
     site(t, shownAt) → [x, y]         the landing site (the shuttle goes there; "Send the team" sits beside it)
     callAt() → [x, y]                 the blink of a waiting call, frame px
     shuttle(dir, t, dur)              'down' | 'up' | null;  shuttleState() → { dir, t0, dur } | null
     skim(t)                           the stream for a few seconds
     draw(ctx, t, { shownAt, call })   the glass into the frame canvas (clipped to the window)
     disc(t, shownAt) → [x, y, r]      the world's disc, frame px (words keep off it)
*/
(function () {
    'use strict';
    const NS = window.NewScreen, P = window.NSPaint, BA = window.NSBridgeArt, D = window.NSDive;
    if (!NS || !NS.on || !P || !BA || !D) return;
    const { RP, INK, smooth, lerp, clamp01, hash } = P, B = BA.B;
    const SW = 640, SH = 360, OFFX = -40;
    const WIN = Object.freeze({ x0: B.WIN.x0 + OFFX, x1: B.WIN.x1 + OFFX, y0: B.WIN.y0, y1: B.WIN.y1 });   // 116..570, 34..236
    const GW = WIN.x1 - WIN.x0, GH = WIN.y1 - WIN.y0;
    const LIGHT = Object.freeze([515, 92]);                               // the light ahead, where the room's art already warms the frame
    const STEPS = D.STEPS, DISSOLVE = D.DISSOLVE, ARRIVE = 3600, GROW = 1.19;
    const ORBIT = { x: 392, y: 140, r: 87 };                              // in orbit the world is 86 % of the window's height
    const FROM = { x: 470, y: 84 };                                       // where it is first seen, small, near the light
    const LIGHT_CAP = { core: 10, halo: 56 };                             // the glass is small: the later sectors' light is held to this
    const LW = P.norm3(0.42, -0.36, 0.83);                                // lit from the front, toward the light
    const DOCK = [WIN.x0 + 70, WIN.y1 + 14];                              // the shuttle's clamp, under the window
    const CALL = [WIN.x0 + 28, WIN.y1 - 44];                              // a waiting call blinks here, low in the open sky (A.U.R.A. speaks high)
    // the real type → one of the five sphere recipes (as travel/Field.js), used only without NSWorlds
    const FAMILY = {
        DESERT: 'desert', SULFUR: 'desert', VOLCANIC: 'desert', TIDALLY_LOCKED: 'desert', RADIATION_BELT: 'desert',
        GAS_GIANT: 'gas', STORM_WORLD: 'gas',
        ICE_WORLD: 'ice', FROZEN_OCEAN: 'ice', OCEANIC: 'ice', CRYSTALLINE: 'ice', MIRROR: 'ice', EDEN: 'ice', VITAL: 'ice', TERRAFORMED: 'ice', SYMBIOTE_WORLD: 'ice', SINGING: 'ice',
        ROCKY: 'rock', SHATTERED: 'rock', MECHA: 'rock', GRAVEYARD: 'rock', TOMB_WORLD: 'rock', HOLLOW: 'rock', MACHINE_WORLD: 'rock',
        ROGUE: 'dark', GHOST_WORLD: 'dark', CARBON: 'dark', TOXIC: 'dark', BIO_MASS: 'dark', FUNGAL: 'dark', WRONG_PLACE: 'dark',
    };
    const SURFACE = { GAS: 'gas', ICE: 'ice', OCEAN: 'ice', VERDANT: 'desert', DESERT: 'desert', ROCK: 'rock', LAVA: 'rock', TOXIC: 'gas' };
    function hashId(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
    const hexOf = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    const mixHex = (a, b, k) => { const x = P.hexRgb(a), y = P.hexRgb(b); return hexOf(x.map((v, i) => v + (y[i] - v) * k)); };

    /** One source per world: the colours the orbit view gives that type (the dither art's ramp, else BodyRenderer's palette),
        as travel/Pictures.js does, so the world in the glass is the world we flew to. */
    const palettes = new Map();
    function paletteOf(type) {
        if (palettes.has(type)) return palettes.get(type);
        const W = window.NSWorlds;
        if (W && typeof W.palette === 'function') { try { const pw = W.palette(type); if (pw && pw.ramp) { palettes.set(type, pw); return pw; } } catch (err) { /* our own copy below */ } }
        const fam = FAMILY[type] || 'rock';
        let out = { ramp: P.PLANET_RAMP[fam] || RP.STONE, atmo: fam === 'desert' ? RP.DUST : RP.ICE, surface: fam };
        try {
            const BR = window.BodyRendererClassic || window.BodyRenderer, pc = BR && typeof BR.palette === 'function' && type ? BR.palette(type) : null;
            const DC = window.DitherCore, DR = window.DitherRecipes, dr = DC && DC.isOn && DR && DR.TYPES && type ? DR.TYPES[type] : null;
            if (dr && Array.isArray(dr.ramp) && dr.ramp.length >= 4) {
                const stops = dr.ramp.slice(1).map(hexOf);
                out = { ramp: P.ramp(INK, ...stops), atmo: P.ramp(INK, ...stops.slice(0, 3)), surface: (pc && SURFACE[pc.fam]) || fam };
            } else if (pc && pc.cfg && pc.cfg.c0) {
                const c = pc.cfg, top = pc.fam === 'GAS' && c.band ? c.band : mixHex(c.c0, c.br || c.c0, 0.45);
                out = { ramp: P.ramp(INK, c.c2, mixHex(c.c2, c.c1, 0.5), c.c1, mixHex(c.c1, c.c0, 0.5), c.c0, top), atmo: P.ramp(INK, c.c2, c.c1, c.c0, c.col || c.c0), surface: SURFACE[pc.fam] || fam };
            }
        } catch (err) { console.error('NewScreen stop: a world palette failed', err); }
        palettes.set(type, out);
        return out;
    }

    // ── which place: from the real node ──
    function kindOf(node) {
        if (!node) return null;
        if (node.isStructure) return 'light';
        if (node._isWrongPlace || node.type === 'WRONG_PLACE') return 'wrong';
        if (node.isStation || node.type === 'STATION') return 'station';
        if (node.isAsteroidField || node.type === 'ASTEROID_FIELD') return 'field';
        let giant = null;
        try { giant = NS.game.route().giant; } catch (err) { giant = null; }
        if (giant && giant === node.id) return 'giant';
        return 'world';
    }
    const isWreck = node => !!(node && (node.type === 'EXODUS_WRECK' || node.isFirstSignal));
    const sectorNow = () => { try { return NS.game.sector() || 1; } catch (err) { return 1; } };
    let cur = null;                                                       // { id, node, kind, seed, sector }

    // ── far space behind the glass, the sector's own strip (repainted only when it drifts a column) ──
    let back = null, backKey = '', backOff = null;
    function backdrop(off) {
        const n = sectorNow(), look = window.NSLooks ? window.NSLooks.of(n) : { seed: 11, dust: 0.12, haze: 1, stars: 1 };
        if (!back || backKey !== String(n)) {
            const strip = P.spaceStrip(GW + 240, GH, look.seed, look.dust, look.haze, look.stars), lit = new Float32Array(GW * GH);
            for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) lit[y * GW + x] = 0.25 + 0.75 * Math.exp(-Math.hypot(x + WIN.x0 - LIGHT[0], (y + WIN.y0 - LIGHT[1]) * 1.15) / 30);
            const c = document.createElement('canvas'); c.width = GW; c.height = GH;
            back = { strip, lit, p: P.painter(GW, GH, true), c, g: c.getContext('2d'), bright: [] };
            backKey = String(n); backOff = null;
        }
        if (backOff === off) return back;
        const keep = (x, y) => Math.hypot(x + WIN.x0 - LIGHT[0], y + WIN.y0 - LIGHT[1]) < 26;
        back.bright = P.paintSpace(back.p, back.strip, off, back.lit, keep);
        back.g.putImageData(new ImageData(back.p.data, GW, GH), 0, 0);
        backOff = off;
        return back;
    }

    // ── the light: the sector's size, x1.19 per world fallen behind (held to the glass) ──
    const glows = new Map();
    function lostCount() {
        try {
            const p = NS.game.route(), here = cur && cur.id;
            return p.worlds.filter(w => w.id !== here && ['visited', 'passed', 'gone'].includes(w.status)).length;
        } catch (err) { return 0; }
    }
    function lightNow() {
        const n = sectorNow(), lost = lostCount(), key = n + ':' + lost + ':' + (cur && cur.kind === 'light' ? 1 : 0);
        if (glows.has(key)) return glows.get(key);
        const base = (window.NSLooks ? window.NSLooks.of(n).light : null) || { core: 2, halo: 14, strength: 1, spikes: 5 };
        const k = Math.pow(GROW, lost) * (cur && cur.kind === 'light' ? 2.4 : 1);
        const o = { core: Math.min(LIGHT_CAP.core * (cur && cur.kind === 'light' ? 2 : 1), base.core * k), halo: Math.min(LIGHT_CAP.halo * (cur && cur.kind === 'light' ? 2 : 1), base.halo * k), strength: base.strength || 1, spikes: (base.spikes || 5) * Math.sqrt(k) };
        const reach = Math.ceil(o.halo * 3.2 + o.core + 10), p = P.painter(reach * 2, reach * 2, false);
        P.lightGlow(p, reach, reach, o);
        const out = { c: p.canvas(), reach };
        if (glows.size > 24) glows.clear();
        glows.set(key, out);
        return out;
    }

    // ── the world at 8 sizes as it brakes in ──
    const pics = new Map();
    const scaleAt = j => lerp(0.3, 1, j / (STEPS - 1));
    function worldExtent(node, r) {
        const W = node && (node._isWrongPlace || node.type === 'WRONG_PLACE') ? null : window.NSWorlds;
        if (W && typeof W.reach === 'function') { try { const k = W.reach(node, sectorNow()); if (k > 0) return Math.ceil(r * k) + 4; } catch (err) { /* the default below */ } }
        return W && typeof W.paint === 'function' ? Math.ceil(r * 1.9) + 4 : r + Math.max(2, Math.round(r / 22)) + 3;
    }
    function paintWorld(pl, sp, half, r, f) {
        const node = pl.node, type = node.type, pal = paletteOf(type), W = window.NSWorlds;
        if (W && typeof W.paint === 'function' && pl.kind !== 'wrong') {   // the Wrong Place is not a world type: our own dark sphere
            try { W.paint(sp, { cx: half, cy: half, r, node, sector: pl.sector, L: LW, grey: false, ramp: pal.ramp, atmo: pal.atmo, dim: 0.7 + 0.3 * f }); return; }
            catch (err) { console.error('NewScreen stop: NSWorlds.paint failed', err); }
        }
        const wrong = pl.kind === 'wrong', fam = wrong ? 'dark' : pal.surface, w = Math.max(2, Math.round(r / 22));
        P.sphere(sp, { cx: half, cy: half, r, ramp: wrong ? RP.DARK : pal.ramp, L: LW, dim: 0.7 + 0.3 * f, surface: P.surfaceFor(fam, pl.seed & 1023, LW), rim: wrong ? 0.3 : 0.12,
            rimRamp: wrong ? RP.RED : undefined, ambient: 0.012, gain: 0.84, atmo: { ramp: wrong ? RP.RED : pal.atmo, w } });
        if (node.isFirstSignal) { const k = r / 118, X = half - 0.6 * r, Y = half + 0.1 * r; sp.line(X + 3 * k, Y + k, X + 16 * k, Y - 2 * k, (x, y) => sp.solid(x, y, RP.STONE, 0.02)); }   // the furrow the wreck cut
    }
    function worldPic(j, place0) {
        const pl = place0 || cur, key = pl.id + ':' + pl.kind + ':' + j;
        if (pics.has(key)) return pics.get(key);
        const f = scaleAt(j), seed = pl.seed;
        let p;
        if (pl.kind === 'giant') {
            const R0 = 280 * f, cx = lerp(330, 30, f * f), cy = lerp(110, 380, f * f);   // pushed in on its limb as we brake; the ring arcs over the glass
            const ramp = paletteOf(pl.node.type).ramp;
            p = D.pic(GW, GH, D.banded(GW, GH, 0, GH, (bp, oy) => P.paintGiant(bp, { cx, cy: cy - oy, R: R0, L: LW, tilt: -0.55, open: 0.3, ramp })));
            p.disc = [cx + WIN.x0, cy + WIN.y0, R0]; p.fixed = true;
        } else if (pl.kind === 'station') {
            const s = 3.6 * f, half = Math.ceil(27 * s + 4);
            p = D.pic(half * 2, half * 2, [g => { const sp = P.painter(half * 2, half * 2, false); p.win = P.drawStation(sp, half, half, s, seed % 7 + 1, 0.75 + 0.25 * f); g.putImageData(new ImageData(sp.data, sp.W, sp.H), 0, 0); }]);
            p.half = half; p.r = 24 * s;
        } else if (pl.kind === 'field') {
            const r = Math.round(ORBIT.r * f * 0.9), half = Math.ceil(r * 1.25) + 4;
            p = D.pic(half * 2, half * 2, [g => {
                const sp = P.painter(half * 2, half * 2, false);
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2 + hash(i, 3, seed & 255) * 1.2, d = (i === 0 ? 0 : 0.5 + 0.45 * hash(i, 5, seed & 255)) * r;
                    const rr = Math.max(2, Math.round(r * (i === 0 ? 0.34 : 0.12 + 0.14 * hash(i, 7, seed & 255))));
                    P.sphere(sp, { cx: half + Math.cos(a) * d, cy: half + Math.sin(a) * d * 0.7, r: rr, ramp: RP.STONE, L: LW, dim: 0.7 + 0.3 * f, surface: P.surfaceFor('rock', (seed + i) & 1023, LW), rim: 0.12, ambient: 0.01, gain: 0.84 });
                }
                g.putImageData(new ImageData(sp.data, sp.W, sp.H), 0, 0);
            }]);
            p.half = half; p.r = r;
        } else if (pl.kind === 'light') {
            p = D.pic(1, 1, []); p.half = 0; p.r = 0; p.none = true;
        } else {
            const r = Math.round(ORBIT.r * f), half = worldExtent(pl.node, r);
            p = D.pic(half * 2, half * 2, [g => { const sp = P.painter(half * 2, half * 2, false); paintWorld(pl, sp, half, r, f); g.putImageData(new ImageData(sp.data, sp.W, sp.H), 0, 0); }]);
            p.half = half; p.r = r;
        }
        pics.set(key, p);
        return p;
    }
    function place(node) {
        if (!node) { cur = null; return; }
        const id = node.id;
        if (cur && cur.id === id && cur.node === node) return;
        if (pics.size > 40) pics.clear();
        cur = { id, node, kind: kindOf(node), seed: hashId(id), sector: sectorNow() };
        for (let j = STEPS - 1; j >= 0; j--) D.first(worldPic(j));        // its sizes, ahead of everything else
    }
    function prepare(node) {
        if (!node) return;
        const pl = { id: node.id, node, kind: kindOf(node), seed: hashId(node.id), sector: sectorNow() };
        for (let j = STEPS - 1; j >= 0; j--) D.later(worldPic(j, pl));
    }
    const arrival = (t, shownAt) => 1 - Math.pow(1 - clamp01((t - shownAt + DISSOLVE) / ARRIVE), 3);
    function geom(t, shownAt) {
        if (!cur) return { x: ORBIT.x, y: ORBIT.y, r: 0, e: 1, j: STEPS - 1, p: null, kind: null };
        const e = arrival(t, shownAt), j = Math.min(STEPS - 1, Math.round(e * (STEPS - 1))), p = worldPic(j);
        if (p.fixed) return { x: p.disc[0], y: p.disc[1], r: p.disc[2], e, j, p, kind: cur.kind };
        if (p.none) return { x: LIGHT[0] - 120, y: LIGHT[1] + 40, r: 40, e, j, p, kind: cur.kind };
        return { x: lerp(FROM.x, ORBIT.x, e), y: lerp(FROM.y, ORBIT.y, e), r: p.r, e, j, p, kind: cur.kind };
    }
    const settled = (t, shownAt) => arrival(t, shownAt) >= 1;
    function siteOf(g) {
        if (!cur) return [ORBIT.x, ORBIT.y];
        if (cur.kind === 'giant') return [WIN.x0 + 150, WIN.y0 + 150];
        if (cur.kind === 'light') return [LIGHT[0], LIGHT[1]];
        return [g.x - 0.6 * g.r, g.y + 0.1 * g.r];
    }
    const site = (t, shownAt) => siteOf(geom(t, shownAt));
    function disc(t, shownAt) {
        const g = geom(t, shownAt);
        if (!cur) return null;
        if (cur.kind === 'light') { const lg = lightNow(); return [LIGHT[0], LIGHT[1], Math.min(80, lg.reach * 0.35)]; }
        return [g.x, g.y, cur.kind === 'station' ? g.r * 1.15 : cur.kind === 'field' ? g.r * 1.2 : g.r];
    }

    // ── the shuttle: a tiny copy of our hull, dropping from under the window to the site, and back ──
    let sh = null;
    const shuttleSprites = new Map();
    function shuttleSprite(len, ang) {
        const key = len + ':' + Math.round(ang * 20); if (shuttleSprites.has(key)) return shuttleSprites.get(key);
        const half = Math.ceil(len / 2 + 6), p = P.painter(half * 2, half * 2, false);
        P.hull(p, { x: half, y: half, len, ht: Math.max(2, len / 3.15), angle: Math.round(ang * 20) / 20, flip: true, seed: 5, anchor: 0.5, flat: true, sun: 0.3, sunDir: [0.94, -0.34] }, P.shapeL);
        const out = { c: p.canvas(), half };
        if (shuttleSprites.size > 64) shuttleSprites.clear();
        shuttleSprites.set(key, out); return out;
    }
    function shuttle(dir, t, dur) { sh = dir ? { dir, t0: t, dur: dur || 2400 } : null; }
    function shuttlePos(t, g) {
        if (!sh) return null;
        const u = clamp01((t - sh.t0) / sh.dur), e = smooth(0, 1, u), s = siteOf(g);
        const [a, b] = sh.dir === 'down' ? [DOCK, s] : [s, DOCK];
        const bend = Math.sin(e * Math.PI) * 26, x = lerp(a[0], b[0], e) + bend * 0.3, y = lerp(a[1], b[1], e) - bend;
        const len = Math.round(sh.dir === 'down' ? lerp(16, 3, e) : lerp(3, 16, e));
        return { x, y, len, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), u };
    }
    function drawShuttle(c, f, t, g) {
        const s = shuttlePos(t, g); if (!s || s.u >= 1 || s.u <= 0) return;
        if (s.len < 5) { f.px(s.x, s.y, RP.HULL.hex[4]); f.tone(s.x - Math.cos(s.ang) * 2, s.y - Math.sin(s.ang) * 2, RP.PLUME, 0.7); return; }
        const sp = shuttleSprite(s.len, s.ang);
        for (let d = 2; d < s.len * 0.8; d++) f.tone(s.x - Math.cos(s.ang) * (s.len / 2 + d), s.y - Math.sin(s.ang) * (s.len / 2 + d), RP.PLUME, 0.8 * (1 - d / (s.len * 0.8)));
        c.drawImage(sp.c, Math.round(s.x) - sp.half, Math.round(s.y) - sp.half);
    }

    // ── skimming: the scoops pull a thin stream of cloud up toward our hull for a few seconds ──
    let skimAt = -1e9;
    function skimFlow(f, el, g) {
        const fade = 1 - smooth(4500, 6000, el), s = siteOf(g), x0b = cur && cur.kind === 'giant' ? WIN.x0 + 100 : s[0] - 20, y0b = cur && cur.kind === 'giant' ? WIN.y0 + 150 : s[1] + 10;
        for (let i = 0; i < 46; i++) {
            const u = ((el / 2400 + hash(i, 1, 21)) % 1), x0 = x0b + hash(i, 2, 21) * 60, y0 = y0b + hash(i, 3, 21) * 30;
            const x = lerp(x0, WIN.x0 + 40 + hash(i, 4, 21) * 30, u), y = lerp(y0, WIN.y1 + 4, u * u);
            f.tone(x, y, RP.SUN, (0.45 + 0.4 * hash(i, 5, 21)) * fade * (1 - u * 0.5));
            if (hash(i, 6, 21) > 0.6) f.tone(x + 1, y - 1, RP.SUN, 0.3 * fade * (1 - u));
        }
    }

    // ── one frame of the glass ──
    function draw(c, t, o) {
        const opts = o || {}, shownAt = opts.shownAt == null ? -1e9 : opts.shownAt;
        const f = P.framer(c, SW, SH), bk = backdrop(Math.floor(t / 900) % 240), lg = lightNow();
        c.save(); c.beginPath(); c.rect(WIN.x0, WIN.y0, GW, GH); c.clip();
        c.drawImage(bk.c, WIN.x0, WIN.y0);
        P.twinkle(f, bk.bright.map(s => ({ x: s.x + WIN.x0, y: s.y + WIN.y0 })), t);
        c.drawImage(lg.c, LIGHT[0] - lg.reach, LIGHT[1] - lg.reach);
        if (opts.call) {                                                  // a call waits: a slow red blink in the open sky
            const [bx, by] = CALL;
            if (t % 3200 < 420) { f.glow(bx, by, 5, RP.RED, 0.6); f.px(bx, by, RP.RED.hex[3], 2, 2); } else f.px(bx, by, RP.RED.hex[1], 2, 1);
        }
        if (cur) {
            const g = geom(t, shownAt), p = g.p && !g.p.none ? D.ready(g.p) : null;
            if (p) { if (p.fixed) c.drawImage(p.canvas, WIN.x0, WIN.y0); else c.drawImage(p.canvas, Math.round(g.x) - p.half, Math.round(g.y) - p.half); }
            const W = window.NSWorlds;
            if (p && cur.kind === 'world' && W && typeof W.live === 'function') { try { W.live(f, cur.node, Math.round(g.x), Math.round(g.y), g.r, t, { L: LW, sector: cur.sector }); } catch (err) { /* the still world is enough */ } }
            const [sx, sy] = siteOf(g).map(Math.round), ph = Math.floor((t % 1500) / 125);
            if (isWreck(cur.node) || cur.kind === 'wrong') {              // our own ship's beacon, still calling
                if (ph < 2) { f.glow(sx, sy, 8, RP.RED, 0.95); f.px(sx - 1, sy - 1, RP.RED.hex[4], 3, 3); } else if (ph < 4) { f.glow(sx, sy, 5, RP.RED, 0.7); f.px(sx, sy, RP.RED.hex[4], 2, 2); } else f.px(sx, sy, RP.RED.hex[ph < 7 ? 3 : 2], 2, 2);
            }
            if (cur.kind === 'station' && p && p.win) f.px(Math.round(g.x) - p.half + p.win[0], Math.round(g.y) - p.half + p.win[1], RP.AMBER.hex[4], 2, 1);
            if (t - skimAt < 6000) skimFlow(f, t - skimAt, g);
            drawShuttle(c, f, t, g);
        }
        c.restore();
    }

    /** Idle work: the backdrop and the light, before they are needed. */
    D.later(D.pic(1, 1, [() => backdrop(0), () => lightNow()]));

    window.NSGlass = Object.freeze({
        SW, SH, OFFX, WIN, LIGHT, place, prepare, geom, settled, disc, draw, shuttle, kindOf,
        site: (t, shownAt) => site(t, shownAt), callAt: () => CALL.slice(), shuttleState: () => (sh ? Object.assign({}, sh) : null),
        skim: t => { skimAt = t; }, current: () => (cur ? { id: cur.id, kind: cur.kind } : null),
    });
})();
