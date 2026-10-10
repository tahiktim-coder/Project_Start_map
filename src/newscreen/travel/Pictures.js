/* ═══ Silent Exodus · new screen (?new=1) · travel/Pictures.js: everything the travel view draws ═══════════════════════
   What it is: the pictures of the space side, painted once per size and kept (the big ones baked in idle frames, so a
   flight never stalls): worlds by their real type, a station with its one lit window, a field of rocks, a ghost, the
   ringed giant in two layers (a world can go between its body and its near ring), the rogue world of sector 2, our Lander
   from outside with its plume and lit ports, the light's glow, the sky backdrop with the far colours, space streaming
   past, the jump's stretch and the corridor's dark, and the dither shade under the hover note.
   Source: prototypes/slice/world.js §4-5 (sprites, worldSprite, stationSprite, giantSprite, landerSprite, glowFrame,
   buildArt, accents, ensureBackdrop, blit, drawItem, drawRims, drawLander, flow, drawJump, corridorArt, drawSector2,
   drawNoteShade), generalised from five fixed places to any planned sector. Recipes: art/Paint.js, art/Sky*.js.
   No randomness: every seed is the hash of a node id (travel/Field.js).

   window.NSPictures (frozen)
     setup(G, ctx)                  after every resize (drops every sprite)       clear()  drop every sprite
     setLive(on)                    while the view runs, big sprites bake in idle frames; off, they bake on the spot
     art(n) → A                     the sector's backdrop (cached per sector at this size); backdrop(A, D, t) draws it
     glow(n, k, t) → { canvas, x, y } · preglow(n, kMax) · lightOf(n, k)   the light's glow at scale k (it grows as worlds
                                    fall behind), drawn at x, y; preglow queues the sizes a sector can reach
     item(f, it, t, o) · rims(f, it, up)   one field item (o: { hidden, resolvedAt }); its lit rim when pointed at
     prebake(items) · bakeOne()     ask for the sizes a move will need; bake one in an idle frame
     lander(f, t, pose, lvl, on, beat)     our Lander outside: pose { x, y, len, angle }, plume level, ports lit, reactor beat
     stream(which, vp, speed, flowPos, front)   space streaming past; which: 'back' | 'front'
     rogue(A, t0, t) · jump(A, s) · dark(t) · dimAll(amount) · shade(rect)
*/
(function () {
    'use strict';
    const P = window.NSPaint, F = window.NSField, LOOKS = window.NSLooks;
    if (!P || !F || !LOOKS) return;
    const { INK, TICK, RP, clamp01, smooth, lerp, hash, threshold } = P;

    let G = null, ctx = null, sc = 1, live = false;
    const geo = () => F.geom(), LPx = () => { const L = F.light(); return [L.x, L.y]; };

    // ═══ 1. sprites: painted once per size; big ones queue and bake in idle frames (the nearest size stands in meanwhile) ═══
    const sprites = new Map(), fams = new Map(), queue = new Map(), landerCache = new Map(), glowCache = new Map(), arts = new Map(), shadeCache = new Map();
    // Bounds, so a push-in (a new radius every frame) and six sectors never pile up canvases: big sizes share a bucket 2 %
    // wide, a family keeps at most FAM_MAX sizes (the farthest from the one asked for goes), the bake queue at most QUEUE_MAX
    // (the oldest goes). A new sector drops everything (Travel calls clear()).
    const FAM_MAX = 24, QUEUE_MAX = 48, BUCKET_FROM = 70;
    const bucket = size => (size < BUCKET_FROM ? size : Math.round(size / Math.max(1, Math.round(size * 0.02))) * Math.max(1, Math.round(size * 0.02)));
    function keep(fam, size, s) {
        const list = fams.get(fam) || fams.set(fam, new Map()).get(fam);
        list.set(size, s); sprites.set(fam + ':' + size, s);
        while (list.size > FAM_MAX) {
            let far = null, fd = -1; list.forEach((v, k) => { const d = Math.abs(k - size); if (d > fd) { fd = d; far = k; } });
            list.delete(far); sprites.delete(fam + ':' + far);
        }
    }
    function want(fam, size0, make, cheap) {
        const size = bucket(size0), key = fam + ':' + size; let s = sprites.get(key);
        if (s) return s;
        const list = fams.get(fam);
        if (cheap || !live || !list || !list.size) { s = make(); keep(fam, size, s); queue.delete(key); return s; }
        if (!queue.has(key)) { queue.set(key, () => { if (!sprites.has(key)) keep(fam, size, make()); }); if (queue.size > QUEUE_MAX) queue.delete(queue.keys().next().value); }
        let best = null, bd = 1e9; list.forEach((v, k) => { const d = Math.abs(k - size); if (d < bd) { bd = d; best = v; } });
        return best;
    }
    function bakeOne() { const it = queue.entries().next(); if (it.done) return; queue.delete(it.value[0]); try { it.value[1](); } catch (err) { console.error('NewScreen travel: a bake failed', err); } }
    function clear() { sprites.clear(); fams.clear(); queue.clear(); landerCache.clear(); glowCache.clear(); arts.clear(); shadeCache.clear(); darkArt = null; patCache.length = 0; }

    const litOf = id => { const p = F.rest(id), LP = LPx(), e = F.entry(id); return P.lightVector(p.x, p.y, LP[0], LP[1], (e && e.kind === 'giant' ? 0.258 : 0.5) * Math.hypot(LP[0] - p.x, LP[1] - p.y)); };
    const shadowL = L => P.norm3(L[0], L[1], -0.62);                                  // the light behind the world: a crescent on the far side
    /** One source per world: the colours the orbit view gives that type (the dither art's own ramp when the dither art is
        on, else BodyRenderer's SVG palette), laid on the travel view's dither: the world you click is the world you arrive
        at. Without either: the travel view's own five recipes. */
    const SURFACE = { GAS: 'gas', ICE: 'ice', OCEAN: 'ice', VERDANT: 'desert', DESERT: 'desert', ROCK: 'rock', LAVA: 'rock', TOXIC: 'gas' };
    const mixHex = (a, b, k) => { const x = P.hexRgb(a), y = P.hexRgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
    const palettes = new Map();
    function paletteOf(e) {
        if (palettes.has(e.type)) return palettes.get(e.type);
        const BR = window.BodyRendererClassic || window.BodyRenderer, pc = BR && typeof BR.palette === 'function' && e.type ? BR.palette(e.type) : null;
        const DC = window.DitherCore, DR = window.DitherRecipes, dr = DC && DC.isOn && DR && DR.TYPES && e.type ? DR.TYPES[e.type] : null;
        const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
        let out = { ramp: P.PLANET_RAMP[e.look] || RP.STONE, atmo: null, surface: e.look };
        if (dr && Array.isArray(dr.ramp) && dr.ramp.length >= 4) {                       // the orbit's dither ramp: night, shadow .. highlight
            const stops = dr.ramp.slice(1).map(hex);
            out = { ramp: P.ramp(INK, ...stops), atmo: P.ramp(INK, ...stops.slice(0, 3)), surface: (pc && SURFACE[pc.fam]) || e.look };
        } else if (pc && pc.cfg && pc.cfg.c0) {
            const c = pc.cfg, top = pc.fam === 'GAS' && c.band ? c.band : mixHex(c.c0, c.br || c.c0, 0.45);
            out = { ramp: P.ramp(INK, c.c2, mixHex(c.c2, c.c1, 0.5), c.c1, mixHex(c.c1, c.c0, 0.5), c.c0, top), atmo: P.ramp(INK, c.c2, c.c1, c.c0, c.col || c.c0), surface: SURFACE[pc.fam] || e.look };
        }
        palettes.set(e.type, out);
        return out;
    }
    const RIMS = { teal: { rim: P.ramp(INK, '#0a1a1a', '#14363a', '#22585c', '#3f8a88', '#7cc2b8'), atmo: P.ramp(INK, '#081616', '#0f2a2c', '#1a4446', '#2c6966'), w: 1.7 },
        dust: { atmo: RP.DUST, w: 1.9 } };
    function worldSprite(e, r, grey) {
        const L0 = litOf(e.id), L = grey ? shadowL(L0) : L0, own = RIMS[e.rim] || {}, w = Math.max(2, Math.round(r / 22 * (own.w || 1))), half = r + w + 3, p = P.painter(half * 2, half * 2, false), rims = [];
        const pal = paletteOf(e);
        P.sphere(p, { cx: half, cy: half, r, ramp: pal.ramp, L, dim: grey ? 0.62 : 1, surface: P.surfaceFor(pal.surface, e.seed, L), rim: grey ? 0.2 : 0.12, rimRamp: own.rim,
            ambient: grey ? 0.006 : 0.012, gain: 0.84, rims, atmo: { ramp: own.atmo || pal.atmo || (e.look === 'desert' ? RP.DUST : RP.ICE), w } });
        if (e.node && e.node.isFirstSignal && !grey && r >= 60) { const k = r / 118, X = half - 0.6 * r, Y = half + 0.1 * r; p.line(X + 3 * k, Y + k, X + 16 * k, Y - 2 * k, (x, y) => p.solid(x, y, RP.STONE, 0.02)); }   // the furrow the wreck cut
        return { canvas: p.canvas(), half, rims: rims.map(([x, y, rr, lv]) => [x - half, y - half, rr, lv]) };
    }
    /** In shadow: darker and cooler, the hue kept (never the flat grey of a disabled button). */
    const SHADOW = [0.42, 0.48, 0.6];
    function shadeCanvas(canvas, k) {
        const g = canvas.getContext('2d'), img = g.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = d[i] * k[0]; d[i + 1] = d[i + 1] * k[1]; d[i + 2] = d[i + 2] * k[2]; }
        g.putImageData(img, 0, 0); return canvas;
    }
    function stationSprite(e, r, grey) {
        const s = r / 24, half = Math.ceil(27 * s + 3), p = P.painter(half * 2, half * 2, false);
        const win = P.drawStation(p, half, half, s, e.seed % 7 + 1, grey ? 0.8 : 1, null);
        const canvas = p.canvas(); if (grey) shadeCanvas(canvas, SHADOW);
        return { canvas, half, win: [win[0] - half, win[1] - half], rims: [] };
    }
    /** A field of rocks and old metal: a few small rock spheres, lit from the light, about the size of a world there. */
    function rocksSprite(e, r, grey) {
        const half = Math.ceil(r * 1.25) + 4, p = P.painter(half * 2, half * 2, false), L0 = litOf(e.id), L = grey ? shadowL(L0) : L0, rims = [];
        const n = 6;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + hash(i, 3, e.seed & 255) * 1.4, d = (i === 0 ? 0 : 0.45 + 0.5 * hash(i, 5, e.seed & 255)) * r, rr = Math.max(2, Math.round(r * (i === 0 ? 0.36 : 0.14 + 0.16 * hash(i, 7, e.seed & 255))));
            P.sphere(p, { cx: half + Math.cos(a) * d, cy: half + Math.sin(a) * d * 0.7, r: rr, ramp: RP.STONE, L, dim: grey ? 0.62 : 1, surface: P.surfaceFor('rock', e.seed + i, L), rim: 0.12, ambient: 0.01, gain: 0.84, rims });
        }
        return { canvas: p.canvas(), half, rims: rims.map(([x, y, rr, lv]) => [x - half, y - half, rr, lv]) };
    }
    /** The giant in two layers: the body with the far ring, and the ring's near arc (w > 0), so a world can go between. */
    function giantSprite(e, R, grey) {
        const half = Math.ceil(R * P.GIANT.r1 * 1.03) + 8, S = half * 2, p = P.painter(S, S, false), Lg = litOf(e.id), out = P.paintGiant(p, { cx: half, cy: half, R, L: grey ? shadowL(Lg) : Lg, ramp: e.node ? paletteOf(e).ramp : null });
        const ct = Math.cos(P.GIANT.tilt), sn = Math.sin(P.GIANT.tilt), open = P.GIANT.open, body = new ImageData(S, S), arc = new ImageData(S, S), d = p.data;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const o = (y * S + x) * 4; if (!d[o + 3]) continue;
            const dx = x + 0.5 - half, dy = y + 0.5 - half, u = dx * ct + dy * sn, w = -dx * sn + dy * ct, rho = Math.hypot(u, w / open) / R;
            let c = [d[o], d[o + 1], d[o + 2]];
            if (grey) c = [c[0] * SHADOW[0], c[1] * SHADOW[1], c[2] * SHADOW[2]];
            const dst = !grey && w > 0 && rho > P.GIANT.r0 - 0.03 && rho < P.GIANT.r1 + 0.03 ? arc : body;
            dst.data[o] = c[0]; dst.data[o + 1] = c[1]; dst.data[o + 2] = c[2]; dst.data[o + 3] = 255;
        }
        const toCanvas = img => { const c = document.createElement('canvas'); c.width = S; c.height = S; c.getContext('2d').putImageData(img, 0, 0); return c; };
        return { canvas: toCanvas(body), arc: grey ? null : toCanvas(arc), half, rims: grey ? [] : out.rims.map(([x, y, rr, lv]) => [x - half, y - half, rr, lv]) };
    }
    function spriteFor(it, queueOnly, grey) {
        const e = F.entry(it.id); if (!e) return null;
        const g = grey == null ? (it.grey >= 1 ? 1 : 0) : grey, prev = live;
        if (queueOnly) live = true;                                                    // pre-baking: only queue, never paint now
        try {
            if (e.kind === 'giant') return want('k' + g + ':' + e.id, it.r, () => giantSprite(e, it.r, !!g), false);
            if (e.kind === 'station') return want('s' + g + ':' + e.id, it.r, () => stationSprite(e, it.r, !!g), it.r < 70);
            if (e.kind === 'rocks') return want('r' + g + ':' + e.id, it.r, () => rocksSprite(e, it.r, !!g), it.r < 70);
            return want('w' + g + ':' + e.id, it.r, () => worldSprite(e, it.r, !!g), it.r < 70);
        } finally { live = prev; }
    }
    function prebake(items) { items.forEach(it => { if (it.part !== 'arc') spriteFor(it, true); }); }

    // ── the Lander from outside (game-screen-v3's paintLander recipe: NSPaint.hull with shapeL) ──
    function landerSprite(len, angle) {
        const deg = Math.round(angle * 90 / Math.PI) * 2, a = deg * Math.PI / 180, key = len + ':' + deg;
        if (landerCache.has(key)) return landerCache.get(key);
        const ht = Math.round(len / 3.15 * 10) / 10, half = Math.ceil(len / 2 + ht + 8), p = P.painter(half * 2, half * 2, false), L = F.lander(), LP = LPx(), sa = Math.atan2(LP[1] - L.y, LP[0] - L.x);
        const o = { x: half, y: half, len, ht, angle: a, flip: true, seed: 9, anchor: 0.5, sun: len < 80 ? 0.24 : 0.32, sunDir: [Math.cos(sa), Math.sin(sa)], fade: 0.22, mirror: false, flat: len < 130 };
        const at = P.hull(p, o, P.shapeL), rel = q => [q[0] - half, q[1] - half];
        const out = { canvas: p.canvas(), half, ports: [0, 1, 2, 3, 4, 5].map(i => rel(at(P.DECK_U(i) + 0.054, -0.32))), bridge: rel(at(P.LANDER.NOSE - 0.02, -0.12)),
            bell: rel(at(1.0, 0)), clamp: rel(at(P.DECK_U(4) + 0.05, 0.56 + 1.2 / ht)), skirt: [0.87, 0.89, 0.91, 0.93].map(u => rel(at(u, 0.6))) };
        if (landerCache.size > 400) landerCache.clear();
        landerCache.set(key, out);
        return out;
    }

    // ── the light: v1's glow, four breathing frames per size ──
    function lightOf(n, k) { const L = LOOKS.of(n).light, s = sc * k; return { core: L.core * s, halo: L.halo * s, strength: L.strength, spikes: L.spikes * sc * Math.sqrt(k) }; }
    /** The glow at scale k, in steps of 12 % (each step baked once; while a new step bakes, the nearest one stands in). Only
        the part on the space side is painted, and a big light (sectors 3-6, or one grown large) breathes in one frame, not
        four: a full-size glow in four frames took seconds to paint and stalled the flight to the light. */
    const GLOW_STEP = Math.log(1.12);
    function glowSteps(k) { return Math.round(Math.log(Math.max(0.5, k)) / GLOW_STEP); }
    function bakeGlow(n, st) {
        const LP = LPx(), L = lightOf(n, Math.exp(st * GLOW_STEP)), reach = Math.ceil(L.halo * 3.2 + L.core + 10);
        const x0 = Math.max(G.hull - 8, Math.floor((LP[0] - reach) / 8) * 8), y0 = Math.max(0, Math.floor((LP[1] - reach) / 8) * 8);
        const x1 = Math.min(G.W, Math.ceil(LP[0] + reach)), y1 = Math.min(G.H, Math.ceil(LP[1] + reach)), frames = reach > 120 ? 1 : 4;
        return Array.from({ length: frames }, (_, i) => { const p = P.painter(x1 - x0, y1 - y0, false); P.lightGlow(p, LP[0] - x0, LP[1] - y0, L, 0.92 + 0.08 * Math.sin(i / 4 * Math.PI * 2)); return { canvas: p.canvas(), x: x0, y: y0 }; });
    }
    function glow(n, k, t) {
        const st = glowSteps(k), key = n + ':' + st;
        let fr = glowCache.get(key);
        if (!fr) {
            const near = [...glowCache.keys()].filter(q => q.startsWith(n + ':')).map(q => +q.split(':')[1]).sort((a, b) => Math.abs(a - st) - Math.abs(b - st))[0];
            if (!live || near == null) { fr = bakeGlow(n, st); glowCache.set(key, fr); }
            else { if (!queue.has('glow:' + key)) queue.set('glow:' + key, () => { if (!glowCache.has(key)) glowCache.set(key, bakeGlow(n, st)); }); fr = glowCache.get(n + ':' + near); }
        }
        return fr[Math.floor(t / 500) % fr.length];
    }
    /** Ask for the glow sizes this sector can need (each world behind us grows the light; held at it or jumping, x1.5). */
    function preglow(n, kMax) { for (let st = 0; st <= glowSteps(kMax); st++) { const key = n + ':' + st; if (!glowCache.has(key) && !queue.has('glow:' + key)) queue.set('glow:' + key, () => { if (!glowCache.has(key)) glowCache.set(key, bakeGlow(n, st)); }); } }

    // ═══ 2. the sky backdrop: sky F (its enormous thing dropped in 1 and 2), the sector's own far colours in 1 and 2 ═══
    function accentList(n) {
        const make = LOOKS.farColours(n, LOOKS.accentRamps()); if (!make) return null;
        const g = geo(), LP = LPx(), L = F.lander(), clearPx = 60 * G.dpr / G.k;
        const near = (x, y) => Math.hypot(x - LP[0], y - LP[1]) < clearPx + 8 || Math.hypot(x - L.x, y - L.y) < clearPx + L.len / 2 ||
            F.ids().some(id => { const p = F.rest(id), e = F.entry(id); return Math.hypot(x - p.x, y - p.y) < clearPx + p.r * (e.kind === 'giant' ? 1.05 : 1); });
        return make.map(a => Object.assign({ ax: g.ax(a.u), ay: g.ay(a.v) }, a, a.r ? { r: a.r * sc } : {}, a.len ? { len: a.len * sc, wide: a.wide * sc } : {}))
            .filter(a => a.kind === 'veil' || !near(a.ax, a.ay));
    }
    function art(n) {
        if (arts.has(n)) return arts.get(n);
        const look = LOOKS.of(n), g = geo(), LP = LPx(), oy = Math.round(G.H / 2 - 180);
        // sky F is painted on a 640 x 360 stage. Sectors 1 and 2 keep the slice's centring (approved); in 3-6, when the space
        // side is wider than the stage, the stage's left edge goes under the tower so no bounded shape (the garden's
        // pillars) shows a cut edge in open space
        const ox = n >= 3 && g.spW > 640 ? Math.round(G.hull - 80) : Math.round(G.hull + g.spW / 2 - 320), light = [LP[0] - ox, LP[1] - oy];
        const acc = accentList(n) || [], S2 = window.NSSky2, RN = S2 && S2.RECIPES && S2.RECIPES[n];
        let sky = null;
        if (S2) {
            const keep = RN && RN.accents;                                              // sky F's accents swapped for the sector's own while it builds (restored at once)
            if (acc.length && RN) RN.accents = acc.filter(a => a.kind !== 'comet' && a.kind !== 'blink').map(a => Object.assign({}, a, { x: a.ax - ox, y: a.ay - oy }));
            try { sky = S2.build(G.W, G.H, ox, oy, n, light, 'f'); } finally { if (acc.length && RN) RN.accents = keep; }
            if (sky && look.divider) sky.thing = null;                                   // 1: the giant is the one enormous thing; 2: the rogue world
        }
        const strip = P.spaceStrip(G.W + 200, G.H, look.seed, look.dust, look.haze * (sky ? sky.haze : 1), look.stars), L = lightOf(n, 1), lit = new Float32Array(G.W * G.H);
        for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) lit[y * G.W + x] = Math.exp(-Math.hypot(x - LP[0], (y - LP[1]) * 1.15) / (L.halo * 0.85 + 6));
        const bp = P.painter(G.W, G.H, true), canvas = document.createElement('canvas'); canvas.width = G.W; canvas.height = G.H;
        const own = acc.filter(a => a.kind === 'comet' || a.kind === 'blink').map(a => Object.assign({ sprite: a.kind === 'comet' ? cometSprite(a) : null }, a));
        const A = { n, sky, strip, lit, bp, canvas, g: canvas.getContext('2d'), key: null, bright: [], keep: L.halo * 0.9 + L.core + 8, own };
        arts.set(n, A);
        return A;
    }
    /** The far comet: a pale jade head and a thin tail pointing away from the light. */
    function cometSprite(a) {
        const LP = LPx(), tail = Math.round(10 * sc), half = tail + 3, p = P.painter(half * 2, half * 2, false), ang = Math.atan2(a.ay - LP[1], a.ax - LP[0]), dx = Math.cos(ang), dy = Math.sin(ang);
        for (let k = tail; k >= 1; k--) { const v = 0.85 * Math.pow(1 - k / (tail + 1), 1.2); p.tone(half + dx * k, half + dy * k, a.ramp, v); if (k < tail * 0.5) p.tone(half + dx * k - dy, half + dy * k + dx, a.ramp, v * 0.45); }
        [[-1, 0], [1, 0], [0, 1], [0, -1]].forEach(([x, y]) => p.tone(half + x, half + y, a.ramp, 0.5));
        p.tone(half, half, a.ramp, 1); p.tone(half + 1, half, a.ramp, 0.82);
        const c = p.canvas(); c.half = half; return c;
    }
    function ensureBackdrop(A, D) {
        const SKY = window.NSSky, LP = LPx(), off = Math.max(0, Math.min(200, Math.round(D * 0.02))), offD = A.sky && SKY ? Math.max(0, Math.min(A.sky.extra - 1, Math.round(D * SKY.DEEP))) : 0, key = off + ':' + offD;
        if (A.key === key) return;
        const keep = (x, y) => Math.hypot(x - LP[0], y - LP[1]) < A.keep;
        A.bright = A.sky && SKY ? SKY.paintSpace(A.bp, A.strip, off, A.lit, keep, A.sky, offD) : P.paintSpace(A.bp, A.strip, off, A.lit, keep);
        A.g.putImageData(new ImageData(A.bp.data, G.W, G.H), 0, 0);
        A.key = key;
    }
    function backdrop(A, D, t) {
        ensureBackdrop(A, D); ctx.drawImage(A.canvas, 0, 0);
        if (A.sky && A.sky.live) A.sky.live(ctx, t, D);                                 // sky F's far motion and the far colours
        const f = P.framer(ctx, G.W, G.H), SKY = window.NSSky, off = A.sky && SKY ? Math.max(0, Math.min(A.sky.extra - 1, Math.round(D * SKY.DEEP))) : 0;
        A.own.forEach(a => {
            const x = Math.round(a.ax - off * a.depth), y = Math.round(a.ay);
            if (a.sprite) { ctx.drawImage(a.sprite, x - a.sprite.half, y - a.sprite.half); return; }
            const ph = (t + 1700) % a.period, on = ph < 625, mid = !on && ph < 1000;       // the slow cyan blink: a dim point always, a cross and a breath when it fires
            f.px(x, y, a.ramp.hex[on ? 6 : mid ? 4 : 3]); f.px(x + 1, y, a.ramp.hex[on ? 5 : 2]);
            if (on || mid) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => f.px(x + dx * (dx > 0 ? 2 : 1), y + dy, a.ramp.hex[on ? 4 : 2]));
            if (on) [[2, 2], [-2, 2], [2, -2], [-2, -2], [0, 3], [0, -3], [-3, 0], [4, 0]].forEach(([dx, dy]) => f.px(x + dx, y + dy, a.ramp.hex[1]));
        });
    }
    /** Sector 2's divider: the rogue world rising where the stars stop (30 s from its first show). */
    function rogue(t0, t) {
        const g = geo(), R = Math.round(0.42 * G.H), s = Math.max(0, t - t0);
        const rg = want('rogue', R, () => { const half = R + 4, p = P.painter(half * 2, half * 2, false); P.paintRogue(p, { cx: half, cy: half, R, L: P.norm3(0.6, -0.8, 0.3) }); return { canvas: p.canvas(), half }; }, true);
        blit(rg.canvas, rg.half, g.ax(0.5), lerp(G.H * 1.4, G.H * 1.04, 1 - (1 - clamp01(s / 30000)) ** 3), null);
    }

    // ═══ 3. drawing helpers ═══
    const patCache = [];
    function pat(n) {
        n = Math.max(0, Math.min(64, Math.round(n)));
        if (!patCache[n]) { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const g = c.getContext('2d'); g.fillStyle = INK; for (let i = 0; i < 64; i++) if (P.BAYER_RAW[i] < n) g.fillRect(i & 7, i >> 3, 1, 1); patCache[n] = ctx.createPattern(c, 'repeat'); }
        return patCache[n];
    }
    function dimAll(amount) { if (amount <= 0) return; ctx.fillStyle = pat(amount * 64); ctx.fillRect(0, 0, G.W, G.H); }
    let scratch = null;
    function scratchOf(w, h) {
        if (!scratch || scratch.c.width < w || scratch.c.height < h) { const c = document.createElement('canvas'); c.width = Math.max(w, scratch ? scratch.c.width : 0); c.height = Math.max(h, scratch ? scratch.c.height : 0); scratch = { c, g: c.getContext('2d', { willReadFrequently: true }) }; }
        scratch.g.clearRect(0, 0, w, h); return scratch.g;
    }
    /** One sprite on screen; cut: hidden where the giant covers it; fade: dithered away; mask: dithered in (colour → shadow). */
    function blit(canvas, half, x, y, o) {
        const X = Math.round(x) - half, Y = Math.round(y) - half, w = canvas.width, h = canvas.height;
        if (!o || (!o.cut && !(o.fade > 0) && o.mask == null)) { ctx.drawImage(canvas, X, Y); return; }
        const g = scratchOf(w, h); g.drawImage(canvas, 0, 0);
        if (o.cut) { const img = g.getImageData(0, 0, w, h), d = img.data; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const i = (yy * w + xx) * 4 + 3; if (d[i] && F.behindGiant(o.cut, X + xx + 0.5, Y + yy + 0.5)) d[i] = 0; } g.putImageData(img, 0, 0); }
        if (o.fade > 0) { g.globalCompositeOperation = 'destination-out'; g.fillStyle = pat(o.fade * 64); g.fillRect(0, 0, w, h); }
        if (o.mask != null) { g.globalCompositeOperation = 'destination-in'; g.fillStyle = pat(o.mask * 64); g.fillRect(0, 0, w, h); }
        g.globalCompositeOperation = 'source-over';
        ctx.drawImage(g.canvas, 0, 0, w, h, X, Y, w, h);
    }

    // ═══ 4. one item of the field ═══
    /** o: { hidden: the story world is still a faint contact, resolvedAt: when it resolved (the contact's last blip) } */
    function item(f, it, t, o) {
        const e = F.entry(it.id); if (!e) return;
        if (o && o.hidden) {                                                            // a far grey disc, lit on its edge, and the contact's slow cold pulse on it
            const x = Math.round(it.x), y = Math.round(it.y), sw = [0, 0.12, 0.26, 0.4, 0.5, 0.4, 0.26, 0.12][Math.floor(t / 500) % 8], rr = Math.max(4, Math.round(3.6 * sc));
            const sp = want('far:' + e.id, rr, () => worldSprite(e, rr, false), true);
            f.glow(x, y, Math.round(rr + (5 + 6 * sw) * sc), RP.ICE, 0.24 + sw * 0.56); f.reset();
            blit(sp.canvas, sp.half, x, y, it.fade > 0 ? { fade: it.fade } : null);
            P.contactBlip(f, x + rr + 1, y - rr - 1, t, false); return;
        }
        const sp = spriteFor(it); if (!sp) return;
        if (e.kind === 'giant') {
            if (it.part === 'arc') { if (sp.arc) blit(sp.arc, sp.half, it.x, it.y); return; }
            if (it.grey > 0 && it.grey < 1) {
                const c0 = spriteFor(it, false, 0); blit(c0.canvas, c0.half, it.x, it.y); blit(sp.canvas, sp.half, it.x, it.y, { mask: it.grey });
                if (it.part === 'all' && c0.arc) blit(c0.arc, c0.half, it.x, it.y, { fade: it.grey }); return;
            }
            blit(sp.canvas, sp.half, it.x, it.y);
            if (it.part === 'all' && sp.arc) blit(sp.arc, sp.half, it.x, it.y);
            return;
        }
        if (it.grey > 0 && it.grey < 1) { const c0 = spriteFor(it, false, 0); blit(c0.canvas, c0.half, it.x, it.y); blit(sp.canvas, sp.half, it.x, it.y, { mask: it.grey }); }
        else blit(sp.canvas, sp.half, it.x, it.y, { cut: it.cut, fade: it.fade });
        if (o && o.resolvedAt != null && t - o.resolvedAt < 900) P.contactBlip(f, Math.round(it.x), Math.round(it.y), t, true);   // the contact resolves into the world
        if (it.grey >= 1 || (it.hiding || 0) > 0.2 || it.fade >= 0.5) return;
        const x = Math.round(it.x), y = Math.round(it.y);
        if (e.kind === 'station') { if (sp.win) f.px(x + sp.win[0], y + sp.win[1], RP.AMBER.hex[4], it.r > 40 ? 2 : 1, 1); return; }   // its one window, lit, steady
        const B = e.beacon; if (!B || it.r < 8) return;
        const X = x + Math.round(B[0] * it.r), Y = y + Math.round(B[1] * it.r), ph = Math.floor((t % B[2]) / TICK);
        if (ph < 3) { f.glow(X, Y, it.r > 40 ? 7 : 4, RP.RED, 0.9); f.px(X, Y, RP.RED.hex[4], it.r > 40 ? 2 : 1, it.r > 40 ? 2 : 1); }   // one of our wrecks: the red beacon blinks
        else f.px(X, Y, RP.RED.hex[2]);
    }
    function rims(f, it, up) {
        const sp = spriteFor(it); if (!sp || !sp.rims) return;
        const x = Math.round(it.x), y = Math.round(it.y);
        sp.rims.forEach(([rx, ry, r, lv]) => f.px(x + rx, y + ry, r.hex[Math.min(r.hex.length - 1, lv + up)]));
    }

    // ═══ 5. our ship outside, space streaming past, the jump, the corridor ═══
    function lander(f, t, pose, lvl, on, beat) {
        const sp = landerSprite(pose.len, pose.angle), cx = Math.round(pose.x), cy = Math.round(pose.y), s = pose.len / 48;
        const ca = Math.cos(pose.angle), sa = Math.sin(pose.angle), bx = cx + sp.bell[0], by = cy + sp.bell[1], frame = Math.floor(t / TICK) % 4;
        for (let i = 0; i < 9; i++) { const age = ((t / 1000) * 0.8 + hash(i, 1, 57)) % 1, dist = (14 + age * 40) * s, side = (hash(i, 2, 57) - 0.5) * age * 9 * s; f.tone(bx - ca * dist - sa * side, by - sa * dist + ca * side, RP.PLUME, 0.62 * (1 - age) * Math.min(1, lvl)); }
        const shut = landerSprite(Math.max(6, Math.round(pose.len * 0.18)), pose.angle);
        ctx.drawImage(shut.canvas, cx + sp.clamp[0] - shut.half, cy + sp.clamp[1] - shut.half);      // the shuttle, clamped beside the hold
        ctx.drawImage(sp.canvas, cx - sp.half, cy - sp.half);
        const flick = [1, 0.72, 1.16, 0.88][frame], hot = [1, 0.86, 1, 0.92][frame], len = (6 + 19 * lvl) * s * flick, w0 = Math.max(1, 1.8 * s * (0.8 + 0.2 * Math.min(lvl, 2)));
        for (let d = 0; d < len; d++) { const hw = w0 * (1 - (d / len) * 0.6); for (let k = -Math.ceil(hw); k <= Math.ceil(hw); k++) { const u = Math.abs(k) / (hw + 0.01), v = (1 - d / len) ** 0.8 * (1 - u * u) * hot; if (v > 0.06) f.tone(bx - ca * d - sa * k, by - sa * d + ca * k, RP.PLUME, v); } }
        sp.skirt.forEach(([x, y], i) => { if ((i + frame) % 2 === 0 || lvl > 1) f.tone(cx + x, cy + y, RP.PLUME, 0.4 + 0.15 * Math.min(lvl, 2)); });
        const hi = beat > 0.55 ? 4 : 3;                                                              // the ports breathe with the reactor
        sp.ports.forEach(([px, py], i) => { if (on[i]) f.px(cx + px, cy + py, RP.AMBER.hex[i === 0 ? hi : hi - 1]); });
        f.px(cx + sp.bridge[0], cy + sp.bridge[1], RP.AMBER.hex[on[0] ? hi : 2]);
    }
    const FLOWS = { motes: { n: 110, seed: 41, rate: 0.0005, tail: 0.1, ramp: 'DUST', v: 0.85, lit: true }, streaks: { n: 230, seed: 43, rate: 0.0015, tail: 0.17, ramp: 'STAR', v: 0.9 },
        near: { n: 30, seed: 47, rate: 0.0027, tail: 0.13, ramp: 'STAR', v: 1.05, wide: 0.5 } };
    const FLOW_LN = Math.log(900 / 22);
    let layerBack = null, layerFront = null;
    function flowInto(L, o, vp, speed, flowPos) {
        const LP = LPx(), spW = G.W - G.hull, ramp0 = RP[o.ramp], tailPh = Math.min(0.12, speed * o.rate * o.tail), n = Math.round(o.n * Math.min(1.6, spW * G.H / (640 * 360))), d0 = 22 * sc;
        for (let i = 0; i < n; i++) {
            const ph = hash(i, 1, o.seed) + hash(i, 7, o.seed) / 256 + flowPos * o.rate, cyc = Math.floor(ph), u = ph - cyc;
            const th = (hash(i + cyc * 13, 2, o.seed) + hash(i, cyc & 255, o.seed + 1) / 256) * Math.PI * 2, dx = Math.cos(th), dy = Math.sin(th);
            const d = d0 * Math.exp(u * FLOW_LN), x = vp[0] + dx * d - G.hull, y = vp[1] + dy * d;
            if (x < -60 || y < -60 || x > L.W + 60 || y > L.H + 60) continue;
            let v = o.v * smooth(d0, 90 * sc, d) * (0.55 + 0.45 * hash(i, 3, o.seed));
            if (o.lit) v *= 0.3 + 1.1 * Math.exp(-Math.hypot(x + G.hull - LP[0], y - LP[1]) / (170 * sc));
            if (v < 0.08) continue;
            const len = Math.max(0, d - d0 * Math.exp(Math.max(0, u - tailPh) * FLOW_LN)), thick = o.wide && hash(i, 5, o.seed) < o.wide;
            for (let k = 0; k <= len; k++) { const a = v * (1 - k / (len + 1)); L.tone(x - dx * k, y - dy * k, ramp0, a); if (thick) L.tone(x - dx * k - dy, y - dy * k + dx, ramp0, a * 0.8); }
        }
    }
    /** which: 'back' (dust motes) or 'front' (streaks and near specks) */
    function stream(which, vp, speed, flowPos) {
        const L = which === 'back' ? layerBack : layerFront; if (!L) return;
        L.clear();
        if (which === 'back') flowInto(L, FLOWS.motes, vp, speed, flowPos);
        else { flowInto(L, FLOWS.streaks, vp, speed, flowPos); flowInto(L, FLOWS.near, vp, speed, flowPos); }
        L.draw(ctx, G.hull, 0);
    }
    /** The jump: the burn runs to full (s < 1.5 s), every star stretches toward the light, white-gold, then black. */
    function jump(A, s) {
        if (s < 1500) return;
        if (s >= 2250) { ctx.fillStyle = RP.SUN.hex[6 - Math.min(3, Math.floor((s - 2250) / 100))]; ctx.fillRect(0, 0, G.W, G.H); return; }   // white-gold, then warm steps (Travel washes the tower too)
        const LP = LPx(), k = Math.min(6, Math.floor((s - 1500) / TICK) + 1), L = P.pixelLayer(G.W, G.H);
        dimAll(k / 8);
        A.bright.forEach(st => { const dx = LP[0] - st.x, dy = LP[1] - st.y, d = Math.hypot(dx, dy) || 1, len = Math.min(d, k * k * 2.6 * sc * (0.5 + st.mag)); for (let i = 0; i < len; i++) L.tone(st.x + dx / d * i, st.y + dy / d * i, RP.STAR, (0.45 + 0.5 * st.mag) * (1 - i / len)); });
        L.draw(ctx);
    }
    /** After the flash: jump space is dark, not empty: a faint teal haze down the corridor, the far light a warm smudge. */
    let darkArt = null;
    function dark() {
        if (!darkArt) {
            const LP = LPx(), p = P.painter(G.W, G.H, true), reach = (G.W - G.hull) * 0.42, L = F.lander();
            p.region(G.hull, 0, G.W, G.H, (x, y) => {
                const dl = Math.hypot(x - LP[0], (y - LP[1]) * 1.6), along = clamp01((x - L.x) / (LP[0] - L.x + 1)), mid = lerp(L.y, LP[1], along), wall = Math.abs(Math.abs(y - mid) - lerp(G.H * 0.34, G.H * 0.04, along));
                const haze = 0.32 * Math.exp(-dl / reach) * (0.6 + 0.6 * P.fbm(x / 23, y / 11, 91, 3)) + 0.16 * Math.exp(-wall / (5 * sc)) * along * (0.5 + P.fbm(x / 9, y / 4, 93, 2));
                if (haze > 0.04) p.tone(x, y, RP.HAZE, haze);
                const core = 0.42 * Math.exp(-dl / (9 * sc)); if (core > 0.05) p.tone(x, y, RP.SUN, core);
            });
            darkArt = p.canvas();
        }
        ctx.drawImage(darkArt, 0, 0);
    }
    /** The picture darkens softly under the hover note (game-screen-v3's shadeSprite, simpler). rect in art px. */
    function shade(r) {
        if (!r) return;
        const pad = 10, key = r.w + 'x' + r.h;
        let c = shadeCache.get(key);
        if (!c) {
            const Wd = r.w + pad * 2, Hd = r.h + pad * 2, p = P.painter(Wd, Hd, false), ink = P.hexRgb(INK), hw = r.w / 2, hh = r.h / 2, round = Math.min(hw, hh);
            p.region(0, 0, Wd, Hd, (x, y) => { const qx = Math.abs(x + 0.5 - pad - hw) - (hw - round), qy = Math.abs(y + 0.5 - pad - hh) - (hh - round), sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round + (P.fbm(x / 7, y / 4, 17, 2) - 0.5) * 10;
                if (0.66 * (1 - smooth(-8, pad, sd)) > threshold(x, y)) p.set(x, y, ink); });
            c = p.canvas(); if (shadeCache.size > 60) shadeCache.clear(); shadeCache.set(key, c);
        }
        ctx.drawImage(c, r.x - pad, r.y - pad);
    }

    function setup(g, c) {
        G = g; ctx = c; sc = G.H / 360; clear();
        layerBack = P.pixelLayer(G.W - G.hull, G.H); layerFront = P.pixelLayer(G.W - G.hull, G.H);
    }

    window.NSPictures = Object.freeze({
        setup, clear, setLive: on => { live = !!on; }, art, backdrop, glow, preglow, lightOf, item, rims, prebake, bakeOne, queued: () => queue.size,
        lander, stream, rogue, jump, dark, dimAll, shade,
    });
})();
