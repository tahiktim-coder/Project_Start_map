/* ═══ Silent Exodus · play ideas · cloud-scoop.js: CLOUD SCOOP, refuelling at a gas giant as a moment you fly ═══════════
   What it is: a standalone mock of one minigame idea (nothing in the game is changed). Playtesters did not understand
   "Skim fuel", so here refuelling is flown: our Lander skims the curved top of a banded gas giant, left to right. Hold the
   mouse or Space to dip into the clouds, let go to climb. Deeper scoops faster (the energy gained shows in small type beside
   the ship) but the hull heats: the nose glows, then the decks flicker red; too hot and A.U.R.A. vents energy to cool the
   hold and pulls up. Gusts push the ship down; storms (pale swirls with lightning) drift by under the cloud tops and burn
   energy. The scoop window is the run to the night side, about 25 seconds, and the night creeping toward the ship is the
   only clock. A.U.R.A. says the result in one line. The decision: how greedy to be (holding the dip all the way loses).

   Reuses the real art, loaded as it is: NSPaint (ramps, the 8 x 8 Bayer dither, noise, the false sun, the space strip),
   NSSky / NSSky2 (sector 1's sky F), NSWorlds (a far moon), MiniShip.lander (our Lander, painted by MiniPaint's hull).
   The giant's cloud bands are Worlds.js's GAS_GIANT surface (calmer here, and in cold colours), laid on a strip that
   scrolls: Worlds paints still spheres, and this one has to turn under the ship. Storms use Worlds.js's STORM_WORLD swirl.
   play-shade.js darkens the picture under the words.
   NO SOUND: nothing here makes any (MiniLab's sound only ever wakes through the game's AudioSystem, which is not loaded).

   The art grid: one art pixel is a whole number of screen pixels (3 at 1920 x 1080, 2 at 1280 x 720: both 640 x 360 art
   pixels), so the dither stays crisp. Everything below thinks in art pixels; K scales the tuning from a 640-wide picture.
   Test hooks: window.cloudScoop.state() → the run's numbers; ?seed=N fixes the gusts and storms. */
(function () {
    'use strict';
    const P = window.NSPaint, SKY = window.NSSky, SKY2 = window.NSSky2, WORLDS = window.NSWorlds, SHIP = window.MiniShip, MP = window.MiniPaint;
    if (!P || !SHIP || !MP) { document.getElementById('line').textContent = 'Cloud Scoop could not load its art.'; return; }
    const { INK, RP, ramp, threshold, fbm, vnoise, smooth, clamp01, seeded, norm3, hash, hexRgb } = P;

    // ── the play: tuning ──
    // Greed must cost: an overheat vents energy and a storm burns some, so holding the dip the whole way ends near zero while
    // dipping and climbing to cool ends near +30 (worked out in a quick sim of these numbers before they went in).
    const T_PLAY = 25;                                  // s: the scoop window, the run to the night side
    const ENERGY0 = 41;                                 // the ship's energy when the pass begins
    const GAIN_MAX = 2.6, GAIN_POW = 1.3;               // energy per second at the deepest dip; deeper pays more than linearly
    const HEAT_IN = 0.26, HEAT_FROM = 0.35;             // heat per second at the deepest dip; no heat above this share of the depth
    const COOL_SHALLOW = 0.16, COOL_ABOVE = 0.26;       // heat lost per second skimming shallow, and out of the clouds
    const VENT = 10, HEAT_AFTER = 0.8, PULL_UP_S = 2.4; // an overheat: energy vented to cool the hold, the heat left, the climb out
    const STORM_HEAT = 0.35, STORM_COST = 6;            // a storm's heat spike and the energy it burns
    const WARN_HEAT = 0.6, RED_DECKS = 0.7;             // Jaxon warns; the decks flicker red
    const HURT_S = 3;                                   // s the hold's deck stays red after a vent
    const MILESTONES = [[10, 'Jaxon', 'Ten in the tanks, Commander.'], [25, 'Jaxon', 'Twenty-five. The tanks are filling up.']];
    const DIVE_V = 100, CLIMB_V = -85, STEER = 3.2;     // px/s (at 640 wide) toward which the ship eases, and how keenly
    const DEPTH_MAX = 56, ABOVE = 48;                   // px: the deepest the belly goes, and the cruise height over the cloud tops
    const FLY = 58;                                     // px/s: the cloud tops passing under the ship (640 wide)
    const IDLE_FLY = 18, OUT_CLIMB = -70;               // the slow drift on the title screen; the climb away at the end
    const HOLD_DECK = 4;                                // the hold in the Lander's deck order: the scoop fills through its hatch
    const SAY_MS = 2800;                                // how long a line in the play stays

    // ── the picture: ramps (all from the ink) ──
    // ART_STYLE.md's colour rule: the universe is cold, only people and the lie are warm. The orbit's GAS_GIANT ramp is a warm
    // brown, so this giant gets a cold one: slate and teal, its top a pale dusty grey (an ice giant's tones, seen big).
    const GIANT = ramp(INK, '#0c151a', '#152530', '#1f3542', '#2d4a56', '#43636a', '#627e80', '#8fa5a0', '#c3cfc6');
    const AIR = RP.ICE;                                 // Worlds.js's air for a giant without its own: a thin cold rim
    const LAVA = ramp(INK, '#2a0c06', '#6a1e0c', '#c4461c', '#ff8a3c', '#ffd08a');   // Worlds.js GLOW.lava: the hot nose (our heat)
    const BOLT = ramp(INK, '#16222e', '#3c5a78', '#9cc4e8', '#f2fbff');              // Worlds.js GLOW.bolt: lightning
    const STORM = ramp(INK, '#0a141c', '#16303e', '#2c5a70', '#5e98b0', '#a8d4e4', '#e8f8fc');   // a storm: pale cold arms round a dark eye
    const LOOK1 = { seed: 11, dust: 0.12, haze: 1, stars: 1, light: { core: 2, halo: 14, strength: 1, spikes: 5 } };   // SectorLooks.js sector 1
    const L_GIANT = norm3(-0.3, -0.66, 0.6);            // the false sun, high and a little behind us, lights the giant
    const TW = 2048;                                    // the cloud strip's length (it wraps seamlessly)
    const LAT_K = 0.0032, LON_K = 0.0085, SALT = 7.3;   // surface px → Worlds' lat / lon, so a band is about 150 px of cloud
    const AMBIENT = 0.012, ATMO = 7;                    // Worlds.js's ambient; px of air above the cloud tops
    const NIGHT_DARK = 0.84;                            // how dark the night side is

    const c32 = rgb => (0xff000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
    const GIANT32 = Uint32Array.from(GIANT.rgb.map(c32)), AIR32 = Uint32Array.from(AIR.rgb.map(c32)), SUN32 = Uint32Array.from(RP.SUN.rgb.map(c32));
    const lerp = (a, b, k) => a + (b - a) * k;

    const url = new URLSearchParams(location.search);
    const fixedSeed = url.has('seed') ? (Number(url.get('seed')) >>> 0) || 1 : null;

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 1. The size: a whole number of screen pixels per art pixel; the geometry of the giant and the ship
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const stage = document.getElementById('stage'), canvas = document.getElementById('view'), ctx = canvas.getContext('2d', { willReadFrequently: true });   // the words' shade reads back
    let G = null;                                       // the built world for this window size

    function measure() {
        const px = Math.max(1, Math.round(window.innerHeight / 360)), W = Math.ceil(window.innerWidth / px), H = Math.ceil(window.innerHeight / px);
        document.documentElement.style.setProperty('--t', clamp01((window.innerWidth - 1280) / 640).toFixed(3));
        document.documentElement.style.setProperty('--px', px + 'px');
        return { px, W, H };
    }

    /** The giant is a sphere far wider than the screen, its top curving across the lower part of the picture. */
    function geometry(W, H) {
        const K = W / 640, R = Math.round(W * 2.4), cx = Math.round(W * 0.42), top = Math.round(H * 0.56), cy = top + R;
        const limbAt = x => cy - Math.sqrt(Math.max(0, R * R - (x - cx) * (x - cx)));
        const shipX = Math.round(W * 0.3), len = Math.round(84 * K);
        return { W, H, K, R, cx, cy, top, limbAt, rows: H - top + 2, shipX, len, hh: len * SHIP.ASPECT / 2, limbShip: limbAt(shipX) };
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 2. The still backdrop: sector 1's sky F, the space strip, the false sun, a far moon (painted once per size)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function buildBackdrop(g) {
        const { W, H } = g, LP = [Math.round(W * 0.45), Math.round(H * 0.1)], ox = Math.round(W / 2 - 320), oy = Math.round(H / 2 - 180);
        let sky = null;
        try { sky = SKY2 ? SKY2.build(W, H, ox, oy, 1, [LP[0] - ox, LP[1] - oy], 'f') : null; } catch (e) { console.warn('Cloud Scoop: no sky F', e); }
        if (sky) sky.thing = null;                                                   // the giant is this sky's enormous thing
        const strip = P.spaceStrip(W + 4, H, LOOK1.seed, LOOK1.dust, LOOK1.haze * (sky ? sky.haze : 1), LOOK1.stars), lit = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lit[y * W + x] = Math.exp(-Math.hypot(x - LP[0], (y - LP[1]) * 1.15) / (LOOK1.light.halo * 0.85 + 6));
        const bp = P.painter(W, H, true), reach = LOOK1.light.halo * 0.9 + LOOK1.light.core + 8;
        const keep = (x, y) => Math.hypot(x - LP[0], y - LP[1]) < reach;
        const bright = sky && SKY ? SKY.paintSpace(bp, strip, 0, lit, keep, sky, 0) : P.paintSpace(bp, strip, 0, lit, keep);
        P.lightGlow(bp, LP[0], LP[1], LOOK1.light, 1);
        const mx = Math.round(W * 0.78), my = Math.round(H * 0.15), mr = Math.max(6, Math.round(9 * g.K));
        if (WORLDS) WORLDS.paint(bp, { cx: mx, cy: my, r: mr, type: 'ICE_WORLD', seed: 23, sector: 1, L: P.lightVector(mx, my, LP[0], LP[1], 60) });
        const stars = P.keepVisible(bp, bright).filter(s => s.y < g.limbAt(s.x) - 4 && Math.hypot(s.x - mx, s.y - my) > mr + 3);
        return { canvas: bp.canvas(), sky, stars, LP };
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. The giant: Worlds.js's GAS_GIANT bands on a strip that wraps; every pixel of the curved top knows where on the
    //    strip it looks (worked out once), so a frame is one lookup and one dither per pixel
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** Worlds.js SURF.GAS_GIANT at (lon, lat) without its one oval (the storms here are their own), with its "seen big" grain.
        Seen this close its bands wiggled like dunes, so here the warp is gentler and slower along the band, and the fine grain
        is long streaks running with the wind. */
    function gasAt(lon, lat) {
        const w = fbm(lon * 0.45 + SALT, lat * 4, SALT, 3), band = 0.5 + 0.5 * Math.sin(lat * 13 + w * 1.7), fine = 0.5 + 0.5 * Math.sin(lat * 37 + w * 2.4);
        const streak = vnoise(lon * 1.6 + SALT, lat * 52, SALT + 41) - 0.5;
        const a = (0.6 + 0.28 * band + 0.1 * fine) * (1 + 0.16 * streak);
        return 1 + (a - 1) * 0.92;                                                   // sector 1 is muted (Worlds.js T.muted)
    }
    /** The strip: rows are depth under the cloud tops (bands squeeze toward the horizon, as on a sphere seen edge on). Only its
        last stretch is cross-faded into its start, so it wraps without a seam at a fraction of the work (the start screen
        builds faster). */
    const FADE = 320;
    function buildStrip(g) {
        const tex = new Float32Array(TW * g.rows), speed = new Float32Array(g.rows);
        for (let r = 0; r < g.rows; r++) {
            const lat = g.R * Math.acos(Math.max(-1, 1 - r / g.R)) * LAT_K;         // surface distance from the horizon
            speed[r] = 1 + 0.55 * r / g.rows + 0.08 * Math.sin(lat * 6.5 + 1);      // nearer rows pass faster; bands drift apart
            for (let c = 0; c < TW; c++) {
                const k = smooth(TW - FADE, TW, c), v = gasAt(c * LON_K, lat);
                tex[r * TW + c] = k > 0 ? (1 - k) * v + k * gasAt((c - TW) * LON_K, lat) : v;
            }
        }
        return { tex, speed };
    }
    /** Every pixel of the giant (and of its thin air): where it looks on the strip and how lit it is. */
    function buildPixels(g) {
        const { W, H, R, cx, cy } = g, depth = new Float32Array(W * H).fill(-1e3);
        const idx = [], row = [], s0 = [], lam = [], thr = [], xs = [], air = [], rim = [];
        for (let y = Math.max(0, g.top - ATMO - 2); y < H; y++) for (let x = 0; x < W; x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dist = Math.hypot(dx, dy), d = R - dist, i = y * W + x;
            depth[i] = d;
            const nx = dx / R, ny = dy / R, nz = Math.sqrt(Math.max(0, 1 - (dist / R) ** 2));
            if (d < 0) {                                                             // the air: Worlds.js's dithered rim on the lit side
                const facing = Math.max(0, (nx * L_GIANT[0] + ny * L_GIANT[1]) / Math.hypot(nx, ny));
                const cover = (1 + d / ATMO) * facing, v = 0.55 * facing;
                if (d > -ATMO && cover > threshold(x + 3, y + 5)) { const k = P.level(AIR, v, x, y); if (k > 0) air.push(i, x, AIR32[k]); }
                continue;
            }
            const l = Math.max(0, (nx * L_GIANT[0] + ny * L_GIANT[1] + nz * L_GIANT[2] + 0.06) / 1.06);
            if (d < 1.2 && l > 0.12) { rim.push(i, x, SUN32[P.level(RP.SUN, Math.min(0.95, 0.25 + 0.12 * l), x, y)]); continue; }   // the warm rim on the lit horizon
            idx.push(i); row.push(Math.min(g.rows - 1, d | 0)); s0.push(Math.atan2(dx, -dy) * R); lam.push(Math.pow(l, 1.1) * 0.9); thr.push(threshold(x, y)); xs.push(x);
        }
        return { depth, n: idx.length, idx: Int32Array.from(idx), row: Int16Array.from(row), s0: Float32Array.from(s0), lam: Float32Array.from(lam),
            thr: Float32Array.from(thr), x: Int16Array.from(xs), air: Uint32Array.from(air), rim: Uint32Array.from(rim) };
    }

    /** One frame of the giant into its layer. scroll: px of cloud passed; night[x]: the light left at column x. */
    function paintGiant(scroll, night) {
        const px = G.px, tex = G.strip.tex, speed = G.strip.speed, buf = G.buf32, top = GIANT32.length - 1;
        const offs = G.offs;
        for (let r = 0; r < offs.length; r++) offs[r] = scroll * speed[r];
        for (let k = 0; k < px.n; k++) {
            const r = px.row[k];
            let c = (px.s0[k] + offs[r]) % TW; if (c < 0) c += TW;
            let pos = (AMBIENT + px.lam[k] * tex[r * TW + (c | 0)]) * night[px.x[k]] * top;
            if (pos > top) pos = top;
            const lo = pos | 0;
            buf[px.idx[k]] = GIANT32[lo < top && pos - lo > px.thr[k] ? lo + 1 : lo];
        }
        for (let k = 0; k < px.air.length; k += 3) buf[px.air[k]] = night[px.air[k + 1]] > 0.5 ? px.air[k + 2] : 0;
        for (let k = 0; k < px.rim.length; k += 3) buf[px.rim[k]] = night[px.rim[k + 1]] > 0.6 ? px.rim[k + 2] : GIANT32[1];
        G.giantCtx.putImageData(G.img, 0, 0, 0, G.top - ATMO - 2, G.W, G.H - (G.top - ATMO - 2));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. The storms: Worlds.js's STORM_WORLD swirl, flattened by the horizon, eight turning frames (8 a second)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** Drawn dark they read as craters, so here a storm is pale, cold arms winding into a dark eye, ringed by a darker wall
        (so it stands off the bands), its top lit, its arms trailing wisps; lightning flickers in it (drawStorms). */
    function stormFrames(rx, ry) {
        const frames = [];
        for (let f = 0; f < 8; f++) for (const dim of [1, 0.4]) {
            const w = Math.ceil(rx * 1.25) * 2 + 4, h = Math.ceil(ry) * 2 + 6, p = P.painter(w, h, false), ph = -f / 8 * Math.PI * 2;
            p.region(0, 0, w, h, (x, y) => {
                const du = (x + 0.5 - w / 2) / rx, dv = (y + 0.5 - h / 2) / ry, rho = Math.hypot(du, dv), th = Math.atan2(dv, du);
                const arm = 0.5 + 0.5 * Math.sin(2 * th - 6 * Math.log(rho + 0.06) + ph);
                if (rho > 1) {                                                         // wisps torn off the arms, trailing back
                    const tail = du > 0.6 ? 0 : smooth(1.25, 1, rho) * Math.pow(arm, 4) * (0.6 + 0.4 * vnoise(x / 3 + f, y, 5));
                    if (tail > 0.25) p.tone(x, y, STORM, 0.45 * tail * dim);
                    return;
                }
                let v = rho < 0.14 ? 0.04 : 0.2 + 0.72 * Math.pow(arm, 2) * (1 - 0.5 * rho);   // a dark eye, pale arms winding in
                if (rho > 0.84) v *= 0.45;                                             // the darker wall round it
                if (dv < -0.55 && rho > 0.6) v = Math.max(v, 0.8 - 0.4 * rho);         // the lit top, so it stands up from the clouds
                p.tone(x, y, STORM, v * dim);
            });
            frames.push({ canvas: p.canvas(), w, h });
        }
        return frames;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 5. Build everything for this window size
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function build() {
        const m = measure(), g = geometry(m.W, m.H);
        canvas.width = g.W; canvas.height = g.H;
        canvas.style.width = g.W * m.px + 'px'; canvas.style.height = g.H * m.px + 'px';
        const t0 = performance.now();
        g.sp = m.px;                                    // screen px per art px (g.px is the giant's pixel table)
        g.px = buildPixels(g);
        g.strip = (G && G.W === g.W && G.H === g.H) ? G.strip : buildStrip(g);
        g.offs = new Float32Array(g.rows);
        g.buf32 = new Uint32Array(g.W * g.H);
        g.img = new ImageData(new Uint8ClampedArray(g.buf32.buffer), g.W, g.H);
        const gc = document.createElement('canvas'); gc.width = g.W; gc.height = g.H; g.giantCtx = gc.getContext('2d'); g.giantCanvas = gc;
        g.back = buildBackdrop(g);
        g.night = new Float32Array(g.W).fill(1);
        g.storms = {};
        g.cover = document.createElement('canvas');
        g.buildMs = Math.round(performance.now() - t0);
        G = g;
        if (S) { S.y = clampShipY(S.y); }
    }
    function stormArt(rx, ry) {
        const key = Math.round(rx) + 'x' + Math.round(ry);
        return G.storms[key] || (G.storms[key] = stormFrames(Math.round(rx), Math.round(ry)));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 6. The run: state, input, the plan of gusts and storms
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let S = null;
    const input = { pointer: false, key: false, armed: true };
    const isDiving = () => (input.pointer || input.key) && input.armed;

    function newState(phase) {
        const seed = fixedSeed != null ? fixedSeed : ((Date.now() ^ (Math.random() * 1e9)) >>> 0) || 1, rand = seeded(seed);
        // gusts every four to six seconds
        const gusts = [4.2, 8.8, 13.6, 18.4, 22.6].map(t => ({ t: t + (rand() - 0.5) * 1.6, push: 60 + rand() * 30, done: false }));
        // five storms at mixed depths, so some sit where a careful dip goes (six was too many to dodge)
        const depths = [14, 30, 22, 40, 34].sort(() => rand() - 0.5);
        const storms = [2.6, 7, 11.4, 15.8, 20.2].map((t, i) => ({ t: t + (rand() - 0.5) * 1.2, dv: depths[i] + rand() * 6, rx: 24 + rand() * 10, ry: 8 + rand() * 3, x: null, hit: false }));
        return {
            phase, seed, rand, t: 0, clock: 0, scroll: 0, y: null, vy: 0, tilt: 0, energy: ENERGY0, heat: 0, depth: -ABOVE,
            gainRate: 0, overheats: 0, hurtUntil: -1, stormHits: 0, lost: 0, lossAt: -9, lossShown: 0, pullUntil: -1, shake: 0, gusts, storms, said: {},
            wisps: [], wake: [], streaks: Array.from({ length: 14 }, () => ({ x: rand(), y: rand(), v: 1.6 + rand() * 1.8, l: 2 + Math.floor(rand() * 4) })),
            gustTell: null, outT: 0, bolts: [], quietUntil: 0,
        };
    }
    /** The ship's heights: the cruise over the cloud tops (the ceiling while scooping), the deepest dip, and the top of the
        climb away at the end. */
    function heights() {
        const cruise = G.limbShip - ABOVE * G.K;
        return { cruise, deep: G.limbShip + DEPTH_MAX * G.K - G.hh, away: cruise - 34 * G.K };
    }
    const clampShipY = y => { const h = heights(); return y == null ? h.cruise : Math.max(h.away, Math.min(h.deep, y)); };

    // ── the words: one line at a time, said by a person; buttons are words ──
    const els = { intro: document.getElementById('intro'), voice: document.getElementById('voice'), who: document.getElementById('who'),
        name: document.getElementById('who-name'), line: document.getElementById('line'), after: document.getElementById('after'),
        fuel: document.getElementById('fuel'), gain: document.getElementById('fuel-gain'), loss: document.getElementById('fuel-loss') };
    const TONE = { 'A.U.R.A.': 'tone-aura', Jaxon: 'tone-jaxon', Mira: 'tone-mira', Aris: 'tone-aris', Vance: 'tone-vance' };
    let sayTimer = 0;
    function say(who, words, ms) {
        clearTimeout(sayTimer);
        if (S) S.quietUntil = S.clock + (ms || SAY_MS) / 1000 + 0.6;          // a milestone waits for quiet; events speak over
        els.who.className = 'who ' + (TONE[who] || '');
        els.name.textContent = who;
        els.line.textContent = words;
        els.voice.classList.add('is-in');
        if (ms) sayTimer = setTimeout(() => els.voice.classList.remove('is-in'), ms);
    }
    function hush() { clearTimeout(sayTimer); els.voice.classList.remove('is-in'); }
    /** A line said once per run. */
    function sayOnce(id, who, words) { if (S.said[id]) return; S.said[id] = true; say(who, words, SAY_MS); }

    function start() {
        const prevY = S ? S.y : null;                          // play again: the ship settles back from where it is
        S = newState('play');
        S.y = clampShipY(prevY);
        input.armed = !(input.pointer || input.key);            // a held key or button from the start screen must be let go first
        els.intro.hidden = true; els.after.hidden = true; hush();
        stage.focus({ preventScroll: true });
    }
    /** The result, said plainly: what we gained, and what greed cost if it cost anything. */
    function finishLine() {
        const g = Math.round(S.energy - ENERGY0), lost = Math.round(S.lost);
        const cause = S.overheats && S.stormHits ? 'The heat and storms' : S.overheats ? 'The heat' : 'The storms';
        if (lost > 0 && g < 0) return `We lost ${-g} energy, Commander. ${cause} took more than we scooped.`;
        if (lost > 0 && g === 0) return `We gained nothing, Commander. ${cause} took it all.`;
        if (lost > 0) return `Plus ${g} energy, Commander. ${cause} cost us ${lost}.`;
        if (g >= 25) return `Plus ${g} energy, Commander. A clean pass.`;
        if (g >= 10) return `Plus ${g} energy, Commander. A careful pass.`;
        return `Only plus ${g} energy, Commander. We stayed too high.`;
    }
    /** Energy lost: it shows beside the ship as a red number for a moment. */
    function lose(n) { S.energy -= n; S.lost += n; S.lossShown = (S.clock - S.lossAt < 1.4 ? S.lossShown : 0) + n; S.lossAt = S.clock; }

    // ── input: hold the mouse or Space (or the down arrow, or S) to dip ──
    const DIVE_KEYS = [' ', 'Spacebar', 'ArrowDown', 's', 'S'];
    stage.addEventListener('pointerdown', e => {
        if (e.target.closest('button, a')) return;
        input.pointer = true; input.armed = true;
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
    });
    const letGo = () => { input.pointer = false; };
    stage.addEventListener('pointerup', letGo);
    stage.addEventListener('pointercancel', letGo);
    window.addEventListener('blur', () => { input.pointer = false; input.key = false; });
    window.addEventListener('keydown', e => {
        const isChoosing = S.phase === 'intro' || S.phase === 'end';
        if (isChoosing && e.key === 'Enter' && e.target.closest && e.target.closest('a, button')) return;   // a focused word acts for itself
        if (isChoosing && (e.key === 'Enter' || e.key === '1' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) start(); return; }
        if (isChoosing && e.key === '2') { e.preventDefault(); location.href = 'index.html'; return; }
        if (DIVE_KEYS.includes(e.key)) { e.preventDefault(); if (!e.repeat) { input.key = true; input.armed = true; } }
    });
    window.addEventListener('keyup', e => {
        if (DIVE_KEYS.includes(e.key)) input.key = false;
        if (!input.pointer && !input.key) input.armed = true;
    });
    document.querySelectorAll('[data-act="start"]').forEach(b => b.addEventListener('click', start));

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 7. One step of the play
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function step(dt) {
        const K = G.K;
        S.clock += dt;
        const playing = S.phase === 'play';
        if (playing) S.t += dt;
        if (S.phase === 'out' || S.phase === 'end') S.outT += dt;
        const fly = S.phase === 'intro' ? IDLE_FLY : FLY;
        S.scroll += fly * K * dt;

        // the ship: eases toward a dive or a climb; A.U.R.A. holds it up after an overheat, and flies it out at the end
        const pulling = playing && S.t < S.pullUntil, hs = heights(), isLow = S.phase === 'play' || S.phase === 'intro';
        let want = playing && isDiving() && !pulling ? DIVE_V : pulling ? CLIMB_V * 1.3 : CLIMB_V;
        if (S.phase === 'out' || S.phase === 'end') want = OUT_CLIMB;
        if (isLow && S.y < hs.cruise - 1 && want < 0) want = 40;                    // back down from the last run's climb away
        S.vy += (want * K - S.vy) * Math.min(1, dt * STEER);
        if (playing) S.gusts.forEach(g => {                                         // a gust: whipped cloud ahead, then a push down
            if (!g.done && S.t > g.t - 0.7 && !S.gustTell) S.gustTell = { t0: S.clock, g };
            if (!g.done && S.t > g.t) { g.done = true; S.vy += g.push * K; S.shake = Math.max(S.shake, 1.6); S.gustTell = null; }
        });
        const ceiling = isLow ? hs.cruise : hs.away;
        let ny = S.y + S.vy * dt;
        if (ny < ceiling && S.y >= ceiling - 0.01) { ny = ceiling; S.vy = Math.max(0, S.vy); }   // the climb levels off here
        if (ny > hs.deep) { ny = hs.deep; S.vy = Math.min(0, S.vy); }                            // the deepest the scoop goes
        S.y = Math.max(hs.away, ny);
        S.tilt = Math.max(-0.14, Math.min(0.14, S.vy / (420 * K)));
        S.depth = (S.y + G.hh - G.limbShip) / K;                                   // the belly under the cloud tops, px at 640 wide

        // scooping and heat
        const f = clamp01(S.depth / DEPTH_MAX);
        S.gainRate = playing && S.depth > 0 ? GAIN_MAX * Math.pow(f, GAIN_POW) : 0;
        S.energy += S.gainRate * dt;
        if (playing) {
            const hot = HEAT_IN * Math.pow(clamp01((f - HEAT_FROM) / (1 - HEAT_FROM)), 1.2);
            S.heat += hot > 0 ? hot * dt : -(S.depth > 0 ? COOL_SHALLOW : COOL_ABOVE) * dt;
        } else S.heat -= COOL_ABOVE * dt;
        S.heat = Math.max(0, S.heat);
        if (S.phase !== 'intro') storms(dt, playing);
        if (playing && S.heat >= WARN_HEAT) sayOnce('hot', 'Jaxon', 'The nose is getting hot. Climb and let it cool.');
        if (playing && S.heat >= 1) {                                               // too hot: A.U.R.A. vents the hold and pulls up
            S.overheats++;
            lose(VENT);
            S.hurtUntil = S.t + HURT_S;
            S.heat = HEAT_AFTER; S.pullUntil = S.t + PULL_UP_S; S.shake = Math.max(S.shake, 3);
            if (S.overheats === 1) say('A.U.R.A.', `Too hot, Commander. I vented ${VENT} energy to cool the hold.`, SAY_MS + 600);
            else say('A.U.R.A.', `Too hot again. Another ${VENT} vented.`, SAY_MS);
        }
        if (playing && S.t > 0.6) sayOnce('start', 'A.U.R.A.', 'Dip to fill the tanks, Commander. We have until the night side.');
        const gained = S.energy - ENERGY0;                                          // a word now and then, so you know how it goes
        if (playing) MILESTONES.forEach(([n, who, words]) => { if (gained >= n && S.clock > S.quietUntil) sayOnce('got' + n, who, words); });
        if (playing && S.t > T_PLAY - 8) sayOnce('night', 'A.U.R.A.', 'Eight seconds to the night side.');
        if (playing && S.t >= T_PLAY) { S.phase = 'out'; S.outT = 0; hush(); }
        if (S.phase === 'out' && S.outT > 1.1 && !S.said.result) { S.said.result = true; say('A.U.R.A.', finishLine(), 0); }
        if (S.phase === 'out' && S.outT > 2.2) { S.phase = 'end'; els.after.hidden = false; }

        // the shake: a jolt that fades, and a shiver when deep and hot
        S.shake = Math.max(0, S.shake - dt * 4);
        particles(dt, f);
    }

    /** Storms drift in from the right at their depth, passing at their row's speed. Touching one is a big heat spike. */
    function storms(dt, canHit) {
        const K = G.K, a = G.len * 0.45, b = G.hh * 0.9;
        S.storms.forEach(s => {
            if (S.t < s.t) return;
            const row = Math.min(G.rows - 1, Math.round(s.dv * K));
            if (s.x == null) s.x = G.W + s.rx * K + 4;
            s.x -= FLY * K * G.strip.speed[row] * dt;
            s.y = G.limbAt(s.x) + s.dv * K;
            // the first storm in sight: Mira says what it is before it can hurt anyone
            if (canHit && s.x < G.W - s.rx * K) sayOnce('storm-seen', 'Mira', 'Storm ahead, under the clouds. It burns. Stay above it.');
            if (!canHit || s.hit || s.x < -60) return;
            const dx = (G.shipX - s.x) / (a + s.rx * K * 0.65), dy = (S.y - s.y) / (b + s.ry * K * 0.65);   // its eye and arms, not its wisps
            if (dx * dx + dy * dy < 1) {
                s.hit = true; S.stormHits++; S.heat += STORM_HEAT; S.shake = Math.max(S.shake, 3.5); S.vy -= 40 * K;
                lose(STORM_COST);
                say('Mira', S.stormHits === 1 ? `We hit the storm. That burned ${STORM_COST} energy.` : `Another storm. ${STORM_COST} more gone.`, SAY_MS);
            }
        });
    }

    /** The scoop made visible: cloud drawn up into the hold's hatch, a churned wake, ice streaking past. */
    function particles(dt, f) {
        const K = G.K, rand = S.rand;
        if (S.gainRate > 0 && rand() < dt * 40 * f) S.wisps.push({ x: G.shipX - G.len * 0.3 + rand() * G.len * 0.8, y: G.limbShip + (2 + rand() * 16) * K + Math.max(0, S.depth) * K * 0.6, age: 0, life: 0.4 + rand() * 0.35, hue: 3 + Math.floor(rand() * 3) });
        S.wisps.forEach(w => { w.age += dt; });
        S.wisps = S.wisps.filter(w => w.age < w.life);
        if (S.depth > -6 && rand() < dt * 30) S.wake.push({ x: G.shipX - G.len * 0.45, y: G.limbShip + (rand() * 6 - 1) * K + Math.max(0, S.depth) * K * 0.3, vx: -(FLY * 1.3 + rand() * 30) * K, vy: -(4 + rand() * 10) * K, age: 0, life: 0.5 + rand() * 0.6 });
        S.wake.forEach(w => { w.age += dt; w.x += w.vx * dt; w.y += w.vy * dt; w.vy += 20 * K * dt; });
        S.wake = S.wake.filter(w => w.age < w.life);
        const fly = S.phase === 'intro' ? IDLE_FLY : FLY;
        S.streaks.forEach(s => { s.x -= s.v * fly * dt / G.W * K * 3; if (s.x < -0.02) { s.x = 1.02; s.y = rand(); } });
        if (rand() < dt * 2.5) S.bolts.push({ x: rand(), d: 10 + rand() * 90, age: 0 });     // lightning, seen only on the night side
        S.bolts.forEach(b => { b.age += dt; });
        S.bolts = S.bolts.filter(b => b.age < 0.25);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 8. One frame of the picture
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** Where the night has reached: off the right edge at the start, at the ship when the window closes. */
    function nightEdge() {
        if (S.phase === 'intro') return G.W + 400;
        const run = S.phase === 'play' ? S.t : Math.min(T_PLAY * 1.3, T_PLAY + S.outT);
        return lerp(G.W + 90 * G.K, G.shipX + G.len * 0.3, run / T_PLAY);
    }

    function draw(ms) {
        const { W, H, K } = G, tq = Math.floor(ms / 125) * 125;   // the moving bits step at 8 a second
        const fr = () => P.framer(ctx, W, H);              // a fresh one per step: each caches the fill colour, which others change
        const sx = S.shake > 0.2 ? Math.round((S.rand() - 0.5) * 2 * S.shake) : 0, sy = S.shake > 0.2 ? Math.round((S.rand() - 0.5) * 2 * S.shake) : 0;
        const hotShiver = S.phase === 'play' && S.heat > 0.5 && S.depth > 10 && tq % 250 === 0 ? 1 : 0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);

        // the far sky does not shake: it is far
        ctx.drawImage(G.back.canvas, 0, 0);
        if (G.back.sky && G.back.sky.live) G.back.sky.live(ctx, ms, S.scroll * 0.05);
        P.twinkle(fr(), G.back.stars, ms);
        ctx.setTransform(1, 0, 0, 1, sx, sy + hotShiver);

        // the giant, its night creeping in from the right
        const edge = nightEdge(), night = G.night;
        for (let x = 0; x < W; x++) night[x] = 1 - NIGHT_DARK * smooth(edge - 60 * K, edge + 40 * K, x);
        paintGiant(S.scroll, night);
        ctx.drawImage(G.giantCanvas, 0, 0);
        drawBolts(fr(), edge);
        drawStorms(tq, edge);
        drawStreaks(fr());
        if (S.gustTell) drawGust(fr(), S.clock - S.gustTell.t0);

        // our Lander, nose right; its drive burns harder on the climb; the night dims it as it passes
        const shipLight = Math.round((0.55 + 0.45 * night[Math.max(0, Math.min(W - 1, G.shipX))]) * 10) / 10;
        const plume = clamp01(0.3 + (S.vy < 0 ? -S.vy / (90 * K) : 0) * 0.6);
        drawWake(fr());
        const bob = S.phase === 'intro' || S.phase === 'end' ? Math.round(Math.sin(S.clock * 1.3) * 2 * K) : 0;   // idle: a slow float
        const L = SHIP.lander(ctx, { x: G.shipX, y: Math.round(S.y) + bob, len: G.len, angle: S.tilt, flip: true, plume, t: ms, sunDir: [-0.7, -0.7], light: shipLight });
        drawHeat(fr(), L, tq);
        drawWisps(fr(), L);
        cloudOver(sx, sy + hotShiver);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (window.PlayShade) PlayShade.under(ctx, W, H, G.sp, [els.intro, els.voice, els.after]);   // no star on a letter
        placeFuel(bob);
    }

    /** The energy gained this pass, in small quiet type beside the ship (the hull's own pixel numbers were too small to read);
        an energy loss shows in red beside it for a moment. */
    function placeFuel(bob) {
        const show = S.phase !== 'intro';
        els.fuel.hidden = !show;
        if (!show) return;
        const g = Math.round(S.energy - ENERGY0), isLoss = S.clock - S.lossAt < 1.4;
        els.gain.textContent = (g < 0 ? '−' : '+') + Math.abs(g);
        els.loss.textContent = isLoss ? '−' + Math.round(S.lossShown) : '';
        els.fuel.classList.toggle('is-drinking', S.gainRate > 0.3);
        const x = (G.shipX - G.len * 0.42) * G.sp, y = (S.y + bob - G.hh - 14 * G.K) * G.sp;
        els.fuel.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }

    function drawStorms(tq, edge) {
        const frame = Math.floor(tq / 125) % 8;
        S.storms.forEach(s => {
            if (s.x == null || s.x < -60) return;
            const fr = stormArt(s.rx * G.K, s.ry * G.K)[frame * 2 + (s.x > edge ? 1 : 0)];
            ctx.drawImage(fr.canvas, Math.round(s.x - fr.w / 2), Math.round(s.y - fr.h / 2));
            if (hash(Math.floor(tq / 125), Math.round(s.t * 10), 31) > 0.72) {        // lightning flickers inside, often: it reads as weather
                const f = P.framer(ctx, G.W, G.H), k = hash(Math.floor(tq / 125), 3, 7) - 0.5;
                f.glow(Math.round(s.x + k * s.rx * G.K), Math.round(s.y + k * s.ry * G.K * 0.6), Math.round(3 + 2 * G.K), BOLT, 0.9);
            }
        });
    }
    function drawBolts(f, edge) {
        S.bolts.forEach(b => {
            const x = Math.round(edge + 20 * G.K + b.x * (G.W - edge)), y = Math.round(G.limbAt(x) + b.d * G.K);
            if (x < edge + 10 || x >= G.W || y >= G.H) return;
            f.glow(x, y, 4, BOLT, 0.7 * (1 - b.age / 0.25));
        });
    }
    function drawStreaks(f) {
        const fly = S.phase === 'intro' ? 0.4 : 1;
        S.streaks.forEach((s, i) => {
            const x = Math.round(s.x * G.W), y = Math.round(G.limbShip - (10 + s.y * 110) * G.K);
            f.px(x, y, i % 3 ? RP.HAZE.hex[4] : RP.STAR.hex[1], Math.max(1, Math.round(s.l * fly * G.K)), 1);
        });
    }
    /** The tell before a gust: the cloud tops whipped up ahead of the ship, racing past for a moment. */
    function drawGust(f, age) {
        const K = G.K;
        for (let i = 0; i < 12; i++) {
            const x = Math.round(G.W - ((age * 900 * K + hash(i, 1, 5) * G.W) % (G.W + 80))), y = Math.round(G.limbAt(x) - (2 + hash(i, 2, 5) * 30) * K);
            f.px(x, y, GIANT.hex[3 + (i % 3)], Math.round((6 + hash(i, 3, 5) * 10) * K), 1);
        }
    }
    function drawWake(f) {
        S.wake.forEach(w => f.tone(w.x, w.y, GIANT, 0.85 * (1 - w.age / w.life), 2, 1));
    }
    /** Cloud drawn up into the hold's hatch on the belly. */
    function drawWisps(f, L) {
        const [hx, hy] = L.at(MP.DECK_U(HOLD_DECK) + 0.045, 0.3);
        S.wisps.forEach(w => {
            const k = smooth(0, 1, w.age / w.life), x = lerp(w.x, hx, k), y = lerp(w.y, hy, k);
            f.px(x, y, GIANT.hex[Math.min(GIANT.hex.length - 1, w.hue)]);
            if (k < 0.7) f.px(x - Math.sign(hx - w.x), y + 1, GIANT.hex[w.hue - 1]);
        });
        if (S.gainRate > 0.3 && Math.floor(performance.now() / 125) % 2) f.glow(Math.round(hx), Math.round(hy), 2, GIANT, 0.5 + 0.2 * S.gainRate);   // the hatch, drinking
    }
    /** Heat: the nose cone glows from its tip back; past the warning the decks flicker red; a damaged deck stays red. */
    function drawHeat(f, L, tq) {
        const h = smooth(0.18, 1, S.heat), len = G.len, ht = len * SHIP.ASPECT, du = 1 / len, dv = 1 / ht;
        if (h > 0) for (let u = 0; u < MP.LANDER.NOSE; u += du) {
            const r = MP.radiusL(u), k = h * Math.pow(1 - u / MP.LANDER.NOSE, 1.4);
            for (let v = -r; v <= r; v += dv) { const [x, y] = L.at(u, v); f.tone(x, y, LAVA, k * (v > 0 ? 1 : 0.7)); }
        }
        if (h > 0.25) { const [nx, ny] = L.at(0, 0.05); f.glow(Math.round(nx), Math.round(ny), Math.round(2 + 6 * h), LAVA, 0.2 + 0.7 * h); }
        const tick = Math.floor(tq / 125);
        for (let d = 0; d < 6; d++) {
            const isDamaged = S.t < S.hurtUntil && d === HOLD_DECK;                      // the vented hold, red for a while
            const flicker = S.heat > RED_DECKS && hash(tick, d, 17) > 0.55 ? 0.3 + 0.3 * hash(tick, d, 19) : 0;
            const k = Math.max(flicker, isDamaged ? (tick % 6 === 0 ? 0.55 : 0.36) : 0);
            if (k <= 0) continue;
            for (let u = MP.DECK_U(d) + du; u < MP.DECK_U(d + 1) - du; u += du) for (let v = -0.42; v <= 0.42; v += dv) { const [x, y] = L.at(u, v); f.tone(x, y, RP.RED, k); }
        }
    }
    /** In the clouds, the clouds close over the ship's lower hull: the giant's own pixels, dithered back over it. */
    function cloudOver(ox, oy) {
        if (S.depth < -G.hh) return;
        const x0 = Math.max(0, Math.round(G.shipX - G.len * 0.62)), x1 = Math.min(G.W, Math.round(G.shipX + G.len * 0.62));
        const y0 = Math.max(0, Math.round(S.y - G.hh - 6)), y1 = Math.min(G.H, Math.round(S.y + G.hh + 8)), w = x1 - x0, h = y1 - y0;
        if (w <= 0 || h <= 0) return;
        const c = G.cover; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        const cc = c.getContext('2d'), img = cc.createImageData(w, h), out = new Uint32Array(img.data.buffer), depth = G.px.depth, buf = G.buf32, sc = S.scroll;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const i = y * G.W + x, d = depth[i] / G.K;
            if (d <= 0) continue;
            const below = smooth(-G.hh * 0.2, G.hh * 1.1, y - S.y);                 // the belly first; the top of the hull stays clear
            const cov = (0.25 + 0.75 * smooth(1, 40, d)) * below + 0.3 * (vnoise((x + sc * 1.2) / 7, y / 3, 9) - 0.5);
            if (cov > threshold(x + 3, y + 5)) out[(y - y0) * w + (x - x0)] = buf[i];
        }
        cc.putImageData(img, 0, 0);
        ctx.drawImage(c, x0, y0);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 9. The loop, the window, the test hooks
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let last = 0;
    function frame(ms) {
        const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0.016;
        last = ms;
        step(dt);
        draw(ms);
        requestAnimationFrame(frame);
    }
    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 200); });

    build();
    S = newState('intro');
    S.y = clampShipY(null);
    requestAnimationFrame(frame);

    window.cloudScoop = Object.freeze({
        state: () => ({ phase: S.phase, t: +S.t.toFixed(2), energy: +S.energy.toFixed(1), gained: Math.round(S.energy - ENERGY0), heat: +S.heat.toFixed(2),
            depth: +S.depth.toFixed(1), lost: S.lost, overheats: S.overheats, stormHits: S.stormHits, buildMs: G.buildMs,
            storms: S.storms.filter(s => s.x != null && !s.hit && s.x > G.shipX - 40).map(s => ({ x: Math.round(s.x - G.shipX), dv: Math.round(s.dv) })) }),
    });
})();
