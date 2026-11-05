/* ═══ Silent Exodus · new screen (?new=1) · cards/FramePictures.js: the frame's picture ═════════════════════════════════
   What it is: the 480 x 160 picture at the top of every frame (cards/Frame.js), painted in the house style (docs/ART_STYLE.md)
   and kept moving at the art's 8 fps until the frame leaves.
     'scene'  SceneArt's own picture (cfg.art): the wreck, the colony, the ruins, an anomaly, the gap, Eden.
     'view'   the sky ahead in this sector's sky F (NSSky / NSSky2): the heading and the light on it. Every card without a
              scene gets at least this. Options: focus 'light' (the light big, for the light and the last jump), signal (a
              call's carrier wave, a whole-pixel dithered trace in --loss across the lower band), blink (what the jump leaves
              behind, a warm point blinking at the left edge).
     'world'  the world the card is about, in that sky: a planet as the bridge glass paints it (NSWorlds), a station and a
              field of rocks by the glass's own painters (NSGlass.paintStation, paintField: the same seed, so the station in
              the card is the one in the window), the copy of Earth (NSEarthArt); the Structure is the light itself. The light
              sits small and high at the right.
     'deck'   one deck of our Lander, live: the tower's own room and crew (NSTower.crop, tower/TowerCard.js) over this
              sector's sky in its windows, at the art's 8 fps, drawn whole. deck { bridge, lab, quarters (galley), medbay, hold
              (cargo), engineering } or who (a crew id: where that person works); who also lights that person, posed where it
              happens; table: the crew round the galley table; crew 'all' and screen: the head count's bridge (C47). Without
              the tower, the room alone (ShipArt.deck), still.
   A view's still part is painted once per sector and focus and cached, a world once per world; prewarm() paints a view in
   an idle moment while a card waits its turn at EncounterCard's gate, so the frame opens on a picture that is already there.
   Loaded only when the new-screen switch is on, after art/Sky2.js and before cards/Frame.js.

   window.NSFramePics (frozen)
     W, H                       480, 160 (art px)
     mount(canvas, spec) → stop()   paints spec into canvas (480 x 160) and keeps it moving; stops by itself once the
                                    canvas has been on the page and left it
     prewarm(spec)              paints a view's still part in an idle moment (a scene needs nothing)
     specOf(spec, state)        the spec as it will be painted: { kind: 'scene' | 'view' | 'world' | 'deck', art, sector,
                                focus, signal, blink, node, deck, who, crew, table, screen }
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const W = 480, H = 160, TICK_MS = 125, NEVER_ATTACHED_MS = 5000;
    const WARM = ['#4a2e12', '#e9a25e', '#fff3dc'];           // the point that blinks at the edge: RP.SUN's own steps (art, not text)
    const WORLD_AT = { x: 0.4, y: 0.54, r: 56 }, ASIDE = { x: 0.84, y: 0.24 };   // a world left of centre; the light small, high right
    const STATION_S = 2.2, FIELD_R = 62;                      // the glass's station and rocks at the picture's height (160 rows)
    const DECKS = { bridge: 0, lab: 1, quarters: 2, galley: 2, medbay: 3, hold: 4, cargo: 4, engineering: 5 };
    const WHO_DECK = { commander: 'bridge', cora: 'bridge', jaxon: 'engineering', aris: 'medbay', vance: 'hold', mira: 'lab' };
    const DECK_CROP = { x: 120, y: 34 };                      // the room inside the hull plates, its floor at the bottom edge
    const cache = new Map();                                  // 'view:<sector>:<focus>' → { canvas, sky } · 'world:<id>:<sector>' → canvas

    const P = () => window.NSPaint || null;
    const SKY = () => window.NSSky || null;
    /** A tokens.css value (a colour the canvas draws in words' meaning: --loss, --ink), or the art's own ink before the sheet. */
    const token = (name, art) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || art;
    const hashId = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

    /** What will be painted: a scene SceneArt knows, a world with a node, a deck the ship has, else the view. */
    function specOf(spec, state) {
        const s = spec || {}, SA = window.SceneArt;
        if (s.kind === 'scene' && s.art && SA && SA.has(s.art)) return { kind: 'scene', art: s.art };
        const sector = Math.max(1, Math.min(6, Number(s.sector) || Number(state && state.currentSector) || 1));
        const deck = s.kind === 'deck' ? (DECKS[s.deck] != null ? s.deck : WHO_DECK[String(s.who || '').toLowerCase()]) : null;
        if (deck && window.ShipArt && typeof window.ShipArt.deck === 'function') return { kind: 'deck', deck, sector, who: s.who ? String(s.who).toLowerCase() : null, crew: s.crew || null, table: !!s.table, screen: s.screen || null };
        const isLight = s.kind === 'world' && s.node && s.node.isStructure;
        if (s.kind === 'world' && s.node && !isLight) return { kind: 'world', node: s.node, sector, signal: !!s.signal };
        return { kind: 'view', sector, focus: s.focus === 'light' || isLight ? 'light' : 'heading', signal: !!s.signal, blink: !!s.blink };
    }
    const keyOf = v => `view:${v.sector}:${v.focus}`;

    /** The still part of a view: sector n's sky F, the dust and stars over it, and the light (on the heading, big, or aside). */
    function paintView(v) {
        const k = keyOf(v);
        if (cache.has(k)) return cache.get(k);
        const p = P();
        if (!p) return null;
        const big = v.focus === 'light', aside = v.focus === 'aside';
        const lx = Math.round(W * (aside ? ASIDE.x : big ? 0.62 : 0.74)), ly = Math.round(H * (aside ? ASIDE.y : big ? 0.5 : 0.44));
        const ox = lx - 320, oy = ly - 180;                                       // the 640 x 360 stage with its light on ours
        let sky = null;
        try { sky = SKY() ? SKY().build(W, H, ox, oy, v.sector, [320, 180]) : null; } catch (err) { console.warn('NSFramePics: no sky F for the view', err); }
        const pt = p.painter(W, H, true), strip = p.spaceStrip(W + 4, H, 61 + v.sector * 7, 0.5, sky ? sky.haze : 1, 1);
        const lit = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lit[y * W + x] = Math.exp(-Math.hypot(x - lx, (y - ly) * 1.15) / (big ? 90 : 60));
        const keep = (x, y) => Math.hypot(x - lx, y - ly) < (big ? 22 : 10);
        if (sky && SKY().paintSpace) SKY().paintSpace(pt, strip, 0, lit, keep, sky, 0); else p.paintSpace(pt, strip, 0, lit, keep);
        p.lightGlow(pt, lx, ly, big ? { core: 5, halo: 24, strength: 1, spikes: 7 } : { core: 1.6, halo: 9, strength: 0.9, spikes: 3 });
        const out = { canvas: pt.canvas(), sky, light: [lx, ly] };
        cache.set(k, out);
        return out;
    }

    /** What kind of place a node is, as the bridge glass reads it. */
    function placeKind(node) {
        const G = window.NSGlass;
        try { if (G && typeof G.kindOf === 'function') return G.kindOf(node) || 'world'; } catch (err) { /* the glass's own guess failed: ours */ }
        if (node.isStation || node.type === 'STATION') return 'station';
        if (node.isAsteroidField || node.type === 'ASTEROID_FIELD') return 'field';
        if (node._isWrongPlace || node.type === 'WRONG_PLACE') return 'wrong';
        return 'world';
    }
    /** The world on its own layer (clear around it), lit from the light aside, as the bridge glass paints it. */
    function paintWorld(v) {
        const node = v.node, k = `world:${node.id != null ? node.id : node.name}:${v.sector}`;
        if (cache.has(k)) return cache.get(k);
        const p = P();
        if (!p) return null;
        const sp = p.painter(W, H, false), cx = Math.round(W * WORLD_AT.x), cy = Math.round(H * WORLD_AT.y), seed = hashId(node.id != null ? node.id : node.name);
        const L = p.norm3(0.42, -0.36, 0.83), kind = placeKind(node), NW = window.NSWorlds, EA = window.NSEarthArt, G = window.NSGlass;
        if (kind === 'station') { if (G && G.paintStation) G.paintStation(sp, cx, cy - 4, STATION_S, node, 1); else p.drawStation(sp, cx, cy - 4, STATION_S, seed % 7 + 1, 1); }
        else if (kind === 'field' && G && G.paintField) G.paintField(sp, cx, cy, FIELD_R, node, 1);
        else if (kind === 'field') {
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2 + p.hash(i, 3, seed & 255) * 1.2, d = (i === 0 ? 0 : 0.5 + 0.45 * p.hash(i, 5, seed & 255)) * FIELD_R;
                const rr = Math.max(3, Math.round(FIELD_R * (i === 0 ? 0.34 : 0.12 + 0.14 * p.hash(i, 7, seed & 255))));
                p.sphere(sp, { cx: cx + Math.cos(a) * d, cy: cy + Math.sin(a) * d * 0.7, r: rr, ramp: p.RP.STONE, L, dim: 1, surface: p.surfaceFor('rock', (seed + i) & 1023, L), rim: 0.12, ambient: 0.01, gain: 0.84 });
            }
        } else if (kind === 'wrong' && EA && typeof EA.paint === 'function') {
            EA.paint(sp, { cx, cy, r: WORLD_AT.r, L, lon: EA.VIEW.lon, lat: EA.VIEW.lat, clouds: 0, dim: 1, lattice: null });
        } else if (NW && typeof NW.paint === 'function') {
            const reach = Math.max(1, Number(NW.reach(node, v.sector)) || 1);
            NW.paint(sp, { cx, cy, r: Math.max(24, Math.min(WORLD_AT.r, Math.floor((H * 0.5) / reach))), node, sector: v.sector, L });
        } else {
            p.sphere(sp, { cx, cy, r: WORLD_AT.r, ramp: p.RP.STONE, L, dim: 1, surface: p.surfaceFor('rock', seed & 1023, L), rim: 0.12, ambient: 0.012, gain: 0.84 });
        }
        const out = sp.canvas();
        cache.set(k, out);
        return out;
    }

    /** A call's carrier wave: steady at the left, breaking up to the right, one art pixel wide, in the lower band (--loss). */
    function drawWave(ctx, t) {
        const p = P(), phase = Math.floor(t / TICK_MS) * 0.55, base = H - 26;
        ctx.fillStyle = token('--loss', ctx.fillStyle);
        for (let x = 6; x < W - 6; x++) {
            const decay = x / W;
            const y = Math.round(base + Math.sin(x * 0.09 + phase) * 7 * (1 - decay * 0.45) + Math.sin(x * 0.31 + phase * 1.7) * 2 * decay);
            if (p && p.threshold(x, y + Math.floor(t / TICK_MS)) < decay * 0.8) continue;   // the dropouts grow, in the house dither
            ctx.fillRect(x, y, 1, 1);
        }
    }
    /** What the jump leaves behind: a warm point at the left edge, on two steps of eight. */
    function drawBlink(ctx, t) {
        if (Math.floor(t / TICK_MS) % 8 >= 2) return;
        const x = 18, y = Math.round(H * 0.56);
        ctx.fillStyle = WARM[0]; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
        ctx.fillStyle = WARM[1]; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
        ctx.fillStyle = WARM[2]; ctx.fillRect(x, y, 1, 1);
    }

    /** Keeps a picture moving at the art's 8 fps until its canvas has been on the page and left it. */
    function run(canvas, paint) {
        const startedAt = performance.now();
        let wasAttached = false, timer = 0;
        const stop = () => { clearInterval(timer); timer = 0; };
        const step = () => {
            const t = performance.now() - startedAt;
            if (canvas.isConnected) wasAttached = true;
            else if (wasAttached || t > NEVER_ATTACHED_MS) { stop(); return; }
            try { paint(t); } catch (err) { stop(); console.error('NSFramePics: a frame of the picture failed', err); }
        };
        timer = setInterval(step, TICK_MS);
        step();
        return stop;
    }
    const inkFill = ctx => { ctx.fillStyle = token('--ink', P() ? P().INK : ctx.fillStyle); ctx.fillRect(0, 0, W, H); };
    /** A deck of our Lander, live: this sector's sky in its windows (the deck leaves them clear), then the tower's own room and
        crew over it (NSTower.crop: the person the card is about lit); without the tower, the room alone, still. */
    function mountDeck(canvas, ctx, s) {
        let sky = null;
        try { sky = paintView({ sector: s.sector, focus: 'heading' }); } catch (err) { console.warn('NSFramePics: no sky for the deck windows', err); }
        const T = window.NSTower, opts = { who: s.who, crew: s.crew, table: s.table, screen: s.screen };
        let still = null;
        return run(canvas, t => {
            ctx.imageSmoothingEnabled = false;
            if (sky) { ctx.drawImage(sky.canvas, 0, 0); if (sky.sky && typeof sky.sky.live === 'function') sky.sky.live(ctx, t, 0); } else inkFill(ctx);
            if (T && typeof T.crop === 'function' && T.crop(s.deck, ctx, opts)) return;
            if (!still) still = window.ShipArt.deck(DECKS[s.deck], {});
            ctx.drawImage(still.canvas, DECK_CROP.x, DECK_CROP.y, W, H, 0, 0, W, H);
        });
    }

    /** Draws and animates until the frame closes (the canvas may be attached after this is called). */
    function mount(canvas, spec) {
        const ctx = canvas && canvas.getContext && canvas.getContext('2d');
        if (!ctx) return () => {};
        const s = specOf(spec, window.app && window.app.state);
        if (s.kind === 'scene') { window.SceneArt.mount(canvas, s.art); return () => {}; }
        if (s.kind === 'deck') return mountDeck(canvas, ctx, s);
        let view = null, world = null;
        try {
            view = paintView(s.kind === 'world' ? { sector: s.sector, focus: 'aside' } : s);
            if (s.kind === 'world') world = paintWorld(s);
        } catch (err) { console.error('NSFramePics: the picture could not be painted', err); }
        return run(canvas, t => {
            if (view) ctx.drawImage(view.canvas, 0, 0); else inkFill(ctx);
            if (view && view.sky && typeof view.sky.live === 'function') view.sky.live(ctx, t, 0);
            if (world) ctx.drawImage(world, 0, 0);
            if (s.signal) drawWave(ctx, t);
            if (s.blink) drawBlink(ctx, t);
        });
    }

    /** A view's still part painted ahead, in an idle moment (a card waiting at the gate). */
    function prewarm(spec) {
        const s = specOf(spec, window.app && window.app.state);
        if (s.kind !== 'view' && s.kind !== 'world') return;
        const v = s.kind === 'world' ? { sector: s.sector, focus: 'aside' } : s;
        if (cache.has(keyOf(v)) && s.kind !== 'world') return;
        const later = window.requestIdleCallback ? fn => window.requestIdleCallback(fn, { timeout: 800 }) : fn => setTimeout(fn, 60);
        later(() => { try { paintView(v); if (s.kind === 'world') paintWorld(s); } catch (err) { console.warn('NSFramePics: prewarm failed', err); } });
    }

    window.NSFramePics = Object.freeze({ W, H, mount, prewarm, specOf });
})();
