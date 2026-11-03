/* ═══ Silent Exodus · new screen (?new=1) · land/LandGroundDraw.js: THE METEOR in the game (PR #32) ═══
   Part of LandGround.js (the copy of prototypes/landing-meteor/landing-ground.js: its header has the GAME: marks and the
   API of window.LandingGround), split off it: what is drawn every frame on the place (its live parts, the pools' glints,
   the lamp's pool at night, the find's light and its little world, the wind, the lightning, the far ground while the
   camera is high, the shuttle, its flames, the crew, the crash), and window.LandingGround itself.
   The split (2026-11-03, the house's 800-line limit): the code moved as it was; nothing in it changed but the names that cross.
   It loads last of the three (LandGround.js, LandSite.js, LandGroundDraw.js) and reads window.LandingGroundParts.
*/
(function () {
    'use strict';
    const Z = window.LandingGroundParts;
    if (!Z) return;                                                          // (LandGround.js did not start: LandFall.js stays out)
    const { P, LAVA_DIM, V, clampX, H, LG, POOL_ALT, threshold, A, LS, SITES, RP, W, OX, hash, U, INK, BOLT, OY, D, TOWER, FW, FH, FAR_TOP, hillY,
        HILL_H, FAR_H, ramp, LADDER, SIGN, MARK, tame, lightAt, prepare, urgent, freeLadder, closeUp, spot, levelNear, levelStretches, markOf } = Z;
    function drawPoolFx(ctx, G, now) {
        if (!G.poolFx || !G.poolFx.length) return;
        const f = P.framer(ctx, CV.w, CV.h), u = Math.max(1, Math.round(CV.d / 2));
        G.poolFx.forEach(([wx, wy], i) => {
            const [ax, ay] = toA(wx, wy);
            if (G.poolSea) { const k = Math.sin(now / 1100 + i * 2.3); if (k > 0.82) f.px(ax, ay, k > 0.95 ? '#d8eef6' : G.S.WATER.hex[4], u * (k > 0.92 ? 2 : 1), 1); }
            else { const k = 0.5 + 0.5 * Math.sin(now / 900 + i * 1.7); if (k > 0.55) f.tone(ax, ay, LAVA_DIM, 0.45 + 0.4 * k, u, u); }
        });
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // Drawing, every frame, in the art px of the picture being shown (CV: its view)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let CV = V;
    const TA = [0, 0];                                                     // toA's answer, reused (read it at once: the next call overwrites it)
    function toA(wx, wy) { TA[0] = (wx - CV.ox) * CV.d; TA[1] = (wy - CV.oy) * CV.d; return TA; }
    let pool = null;
    /** The lamp's pool under the shuttle at night: the lit picture shown through a whole dithered ellipse, brightest under
        the lamp and thinning to nothing at its edge, climbing whatever it touches; a faint dithered cone of the lamp's light
        joins the belly to it. Its spread and strength follow the height (masks on coarse steps, reused as it falls). */
    function lampPool(ctx, pic, G, s) {
        const g = G.g, x = Math.round(s.x), ground = g.heights[clampX(x)], d = CV.d;
        if (ground > H) return;
        const alt = Math.max(0, ground - (s.y + LG.LANDER_TALL));
        if (alt > POOL_ALT) return;
        const k = Math.round((1 - alt / POOL_ALT) * 6) / 6, rx = Math.round((9 + alt * 0.3) * d / 4) * 4, ry = Math.max(8, Math.round((6 + alt * 0.08) * d / 4) * 4);
        const cx = (s.x - CV.ox) * d, cy = (ground - 1 - CV.oy) * d, bx = Math.round(cx - rx), by = Math.round(cy - ry);
        if (!pool) { const c = document.createElement('canvas'); c.width = 260; c.height = 200; pool = { c, g: c.getContext('2d'), masks: new Map() }; }
        const key = rx + ':' + ry + ':' + k;
        let mask = pool.masks.get(key);
        if (!mask) {
            mask = document.createElement('canvas'); mask.width = rx * 2; mask.height = ry * 2;
            const mg = mask.getContext('2d'), img = mg.createImageData(rx * 2, ry * 2);
            for (let y = 0; y < ry * 2; y++) for (let xx = 0; xx < rx * 2; xx++) {
                const q = ((xx + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2;
                if (q < 1 && Math.pow(1 - q, 1.15) * (0.3 + 0.85 * k) > threshold(xx, y)) img.data[(y * rx * 2 + xx) * 4 + 3] = 255;
            }
            mg.putImageData(img, 0, 0);
            if (pool.masks.size > 40) pool.masks.clear();
            pool.masks.set(key, mask);
        }
        const pg = pool.g, w = Math.min(260, rx * 2), h = Math.min(200, ry * 2);
        pg.globalCompositeOperation = 'copy'; pg.drawImage(pic.lit, bx, by, w, h, 0, 0, w, h);
        pg.globalCompositeOperation = 'destination-in'; pg.drawImage(mask, 0, 0);
        pg.globalCompositeOperation = 'source-over';
        ctx.drawImage(pool.c, 0, 0, w, h, bx, by, w, h);
        const f = P.framer(ctx, CV.w, CV.h), [lx, ly] = toA(s.x, s.y + LG.LANDER_TALL - 0.5), ay1 = cy - ry * 0.3, span = ay1 - ly;   // the cone
        if (span < 4) return;
        for (let ay = Math.ceil(ly + 2); ay < ay1; ay++) {
            const t = (ay - ly) / span, hw = 1.2 * d + t * rx * 0.85, dens = (0.05 + 0.12 * k) * (1 - 0.45 * t);
            for (let ax = Math.floor(lx - hw); ax <= lx + hw; ax++) { const e = 1 - Math.abs(ax - lx) / hw; if (threshold(ax, ay) < dens * e) f.px(ax, ay, A.R.LAMP.hex[2]); }
        }
    }

    /** The place and what moves on it. o: { pic, nozzles, flash (lightning), bolt, gust: { k, warn, dir }, out, burn } */
    function draw(ctx, G, s, now, o) {
        o = o || {};
        const pic = o.pic || G.main, { g, scene } = G, night = G.tod === 'night' && pic.dark;
        CV = pic.V;
        tame(G);
        const back = o.flash || !night ? pic.lit : pic.dark;
        scene.close = { V: pic.V, done: !!back, canvas: back || pic.lit };     // drawLive draws the backdrop it finds here
        LS.drawLive(ctx, scene, G.gDraw, s, now, o.nozzles || [], pic.V);
        drawPoolFx(ctx, G, now);
        if (night && !o.flash && s && !s.hide && s.grade !== 'crash') { lampPool(ctx, pic, G, s); if (g.site && SITES) SITES.drawLive(ctx, g, now, pic.V, scene.S); }
        if (o.flash && o.bolt) bolt(ctx, G, o.bolt);
        G.lightDrawn = drawMark(ctx, G, now, o);
        if (o.gust && (o.gust.warn > 0 || o.gust.k > 0)) gustWisps(ctx, G, s, now, o.gust);
        else if (G.world.atm > 0 && g.wind) windSpecks(ctx, G, now);
    }
    /** The steady wind: a few specks of dust carried along it, each on its own slight wave (never a line). */
    function windSpecks(ctx, G, now) {
        const f = P.framer(ctx, CV.w, CV.h), g = G.g, air = G.S.airRamp || RP.ICE, sp = g.wind * 9, n = 16;
        for (let i = 0; i < n; i++) {
            const span = W - OX + 20, x = OX - 10 + ((((now / 1000) * sp * (0.7 + hash(i, 3, 29) * 0.6) + hash(i, 4, 29) * span) % span) + span) % span;
            const y = 20 + hash(i, 5, 29) * 125 + Math.sin(now / 700 + i * 1.9) * 1.5, [ax, ay] = toA(x, y);
            f.tone(ax, ay, air, 0.35 + 0.25 * hash(i, 6, 29), CV.d >= 3 && hash(i, 7, 29) > 0.5 ? 2 : 1, 1);
        }
    }

    /** The find's own light on the ground (the same as from orbit), and its little world: smoke, the pad's lamps, the posts. */
    function drawMark(ctx, G, now, o) {
        const f = P.framer(ctx, CV.w, CV.h), g = G.g, wind = Math.sign(g.wind || 0), night = G.tod === 'night', sc = 1.5 * CV.d;
        if (G.mark === 'colony' && G.lamps) G.lamps.forEach(l => { const [lx, ly] = toA(l.x, l.y); if (l.on) { f.glow(lx, ly, Math.round(2 * CV.d), RP.AMBER, 0.45); f.px(lx - 1, ly, RP.AMBER.hex[4], Math.round(CV.d), Math.round(CV.d)); } else f.px(lx - 1, ly, RP.HULL.hex[1], Math.round(CV.d), Math.max(1, Math.round(CV.d / 2))); });
        if (G.mark === 'machines' && G.posts) { let shown = false; G.posts.forEach(q => { const [lx, ly] = toA(q.x, q.y); shown = A.drawLight(f, 'machines', lx, ly, now, { post: true, scale: sc }) || shown; }); return shown; }
        if (G.mark === 'none') return false;
        if (G.mark === 'signal') return signalRings(f, G, now, o);
        if (G.mark === 'life') return lifePatch(f, G, now, night);
        const p = lightAt(G), [ax, ay] = toA(p.x, p.y);
        if (G.mark === 'flare' && !o.out && (o.burn == null || o.burn > 0)) flarePool(f, G, p, now, o.burn == null ? 1 : o.burn);
        return A.drawLight(f, G.mark, ax, ay, now, { night, scale: sc, wind, out: o.out, burn: o.burn, lit: true });   // on the ground its glow only brightens
    }
    /** The flare's red light on the ground round it (and on the walls and slopes it touches), flickering with it. */
    function flarePool(f, G, p, now, burn) {
        const g = G.g, d = CV.d, st = 1 / d, R0 = 15, fl = 0.8 + 0.2 * hash(Math.floor(now / 90) & 255, 3, 41);
        for (let wx = p.x - R0; wx <= p.x + R0; wx += st) {
            const top = U.hAt(g, wx); if (top > H) continue;
            for (let r = -0.5; r < 3; r += st) {
                const dist = Math.hypot(wx - p.x, (top + r - p.y) * 1.6) / R0; if (dist >= 1) continue;
                const a = Math.pow(1 - dist, 1.6) * 0.62 * burn * fl * (1 - r / 3.5), [ax, ay] = toA(wx, top + r);
                if (threshold(Math.round(ax), Math.round(ay)) < a) f.tone(ax, ay, RP.RED, 0.32 + 0.3 * a);
            }
        }
    }
    /** The old signal on the ground: its amber lamp on the mast and, with each flash, two or three short arcs close to it,
        each a step dimmer than the one inside it, 1-2 art px thick. */
    function signalRings(f, G, now, o) {
        const b = G.sig; if (!b || o.out) return false;
        const [ax, ay] = toA(b.x, b.y), d = CV.d, q = (now % 1800) / 1800, flash = q < 0.09, u = Math.max(1, Math.round(d / 2)), th = d >= 3 ? 2 : 1;
        f.glow(ax, ay, Math.round((flash ? 4 : 2) * d), RP.AMBER, flash ? 0.95 : q < 0.5 ? 0.5 : 0.28);
        f.px(ax - (u >> 1), ay - (u >> 1), flash ? '#fff3dc' : RP.AMBER.hex[3], u, u);
        for (let i = 0; i < 3; i++) {
            const age = q - (0.02 + i * 0.06);
            if (age < 0 || age > 0.33) continue;
            const hex = RP.AMBER.hex[Math.max(1, 4 - i - Math.floor(age / 0.11))], rad = (2.6 + i * 2.2) * d;
            [-1, 1].forEach(side => { for (let a = -0.55; a <= 0.55; a += 0.9 / rad) f.px(ax + side * Math.cos(a) * rad - (th >> 1), ay + Math.sin(a) * rad * 0.9, hex, th, th); });
        }
        return true;
    }
    /** Life: no flare. At night a teal patch on the ground breathing; by day a dark patch that moves. */
    function lifePatch(f, G, now, night) {
        const g = G.g, c = lightAt(G), w = 14, st = 1 / CV.d;
        for (let dx = -w; dx <= w; dx += st) {
            const wx = c.x + dx + (night ? 0 : Math.sin(now / 2600) * 6), col = Math.max(0, Math.min(W - 1, Math.round(wx))), top = U.hAt(g, wx);
            if (top > H || (g.hot[col] && !g.kind.sea)) continue;                    // over the sea it moves in the water
            const edge = 1 - Math.abs(dx) / w, ax = (wx - CV.ox) * CV.d, tx = Math.round(ax);
            for (let r = 0; r < 1.5; r += st) {
                const ay = (top - 0.5 + r - CV.oy) * CV.d, ty = Math.round(ay);
                if (night) { const b = 0.5 + 0.5 * Math.sin(now / 1300 + dx * 0.05); if (threshold(tx, ty) < edge * (0.5 + 0.4 * b)) f.tone(ax, ay, A.R.TEAL, 0.3 + 0.35 * b * edge); }
                else if (threshold(tx, ty) < edge * 0.85) f.px(ax, ay, r > 0.5 ? '#0a1317' : INK);
            }
        }
        return true;
    }
    /** Lightning: a jagged bolt from the cloud to the far ground, stepped per art px (2 px wide close up), and the sky
        under the deck flashing round where it leaves the cloud. */
    function bolt(ctx, G, b) {
        const f = P.framer(ctx, CV.w, CV.h), w = CV.d >= 3 ? 2 : 1;
        const [sx, sy] = toA(b.x, G.cloudBase + 4);
        f.glow(Math.round(sx), Math.round(sy + 10 * CV.d), Math.round(34 * CV.d / 2), BOLT, 0.42);
        let x = b.x, y = G.cloudBase + 4;
        while (y < b.y) {
            const ny = y + 3 + hash(Math.round(y) & 255, b.seed & 255, 3) * 5, nx = x + (hash(b.seed & 255, Math.round(y) & 255, 5) - 0.5) * 8;
            const ax0 = (x - CV.ox) * CV.d, ay0 = (y - CV.oy) * CV.d, ax1 = (nx - CV.ox) * CV.d, ay1 = (ny - CV.oy) * CV.d, n = Math.max(1, Math.ceil(Math.max(Math.abs(ax1 - ax0), Math.abs(ay1 - ay0))));
            for (let k = 0; k <= n; k++) f.px(Math.round(ax0 + (ax1 - ax0) * k / n), Math.round(ay0 + (ay1 - ay0) * k / n), k % 4 ? '#9cc4e8' : '#f2fbff', w, w);
            x = nx; y = ny;
        }
    }
    /** A gust: wisps of the air going by (uneven specks on a slight wave, with gaps, never a line), 0.8 s ahead of it and
        while it blows; and dust torn off the ground, lifting and carried downwind. */
    function gustWisps(ctx, G, s, now, gust) {
        const f = P.framer(ctx, CV.w, CV.h), air = G.S.airRamp || RP.ICE, dir = gust.dir || 1, k = Math.max(gust.warn, gust.k);
        const n = Math.round(4 + 9 * k);
        for (let i = 0; i < n; i++) {
            const y0 = (s ? s.y : 0) - 30 + hash(i, 4, 11) * 70, len = 9 + hash(i, 5, 11) * 14, sp = 120 + 80 * hash(i, 6, 11), ph = hash(i, 8, 11) * 6.28;
            const x0 = dir > 0 ? OX - 20 + ((now / 1000 * sp + hash(i, 7, 11) * 600) % (W - OX + 40)) : W + 20 - ((now / 1000 * sp + hash(i, 7, 11) * 600) % (W - OX + 40));
            for (let j = 0; j < len; j += 0.8 + hash((i * 5 + Math.round(j * 2)) & 255, 9, 11) * 1.3) {
                if (hash((i * 11 + Math.round(j * 3)) & 255, 12, 11) < 0.3) continue;
                const q = j / len, [ax, ay] = toA(x0 - dir * j, y0 + Math.sin(ph + j * 0.45 + now / 260) * 0.7);
                f.tone(ax, ay, air, (0.42 + 0.4 * k) * (1 - q * 0.8));
            }
        }
        if (gust.k <= 0.05) return;
        const g = G.g, dust = G.S.GRD;
        for (let i = 0; i < 34; i++) {
            const wx0 = hash(i, 21, 11) * W, top = U.hAt(g, wx0); if (top > H) continue;
            const age = ((now / 850) + hash(i, 22, 11)) % 1, [ax, ay] = toA(wx0 + dir * age * 28, top - 0.5 - age * 8 - Math.sin(age * 9 + i) * 0.8);
            f.tone(ax, ay, dust, (0.62 - 0.5 * age) * gust.k, CV.d >= 3 ? 2 : 1, 1);
        }
    }
    /** The cloud we fell out of: a ragged base across the top of the sky screen (baked in strips), drifting with the wind.
        Seen from under it: dark, lighter at its torn edge, in the world's own (muted) cloud colour. Airless worlds have none. */
    function cloudBake(G, tag) {
        if (!(G.world.atm > 0)) return null;
        const h = Math.ceil((G.cloudBase - OY + 14) * D), cloud = G.S.cloud || A.mute(RP.DUST), seed = (G.world.seed || 3) + 31, night = G.tod === 'night';
        return A.stripBake(V.w + 160, h, (p, y0) => {                         // 8-row strips: about 7000 px of noise a job
            for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
                const ay = y + y0, n = P.fbm(x / 70, ay / 26, seed, 3), edge = h - 1 - ay - (n - 0.4) * 34;
                if (edge < 0 || (edge < 8 && threshold(x, ay) > edge / 8)) continue;
                p.solid(x, y, cloud, (0.14 + 0.24 * n + (edge < 4 ? 0.14 : 0)) * (night ? 0.6 : 1));
            }
        }, tag, false, 8);
    }
    function cloudBase(ctx, G, now) {
        if (!G.cloud || !G.cloud.done) return;
        const drift = ((Math.round((now / 1000) * (G.g.wind0 || G.g.wind || 0.6) * 2) % 160) + 160) % 160;
        ctx.drawImage(G.cloud.canvas, -drift, 0);
    }

    // ── the ground far below, while the camera is still high ──
    /** Where the highest ground in the frame is, in art y, for the camera at cam (world px, top left). */
    function groundTopY(G, cam) {
        const g = G.g, x0 = Math.max(0, Math.floor(cam.ox + TOWER / D)), x1 = Math.min(W - 1, Math.ceil(cam.ox + FW / D));
        let top = H + 40;
        for (let x = x0; x <= x1; x++) if (g.heights[x] < top) top = g.heights[x];
        return (top - cam.oy) * D;
    }
    /** The ground far below as layered hills at the frame's foot (its top pinned FAR_TOP px up), squeezed upright the farther
        it is: a far range, hazy, then the near ground's face in bands, its light on it and its lamps (a colony's windows, the
        machines' blink) seen through the air. Once the real ground reaches that line it takes over. */
    function farGround(ctx, G, cam, now, o) {
        const gy = groundTopY(G, cam), pin = FH - FAR_TOP;
        if (gy <= pin) return false;
        const g = G.g, S = G.S, c = Math.max(0.3, pin / gy), hmin = gy / D + cam.oy, night = G.tod === 'night', fade = Math.min(1, (gy - pin) / 24), T = G.far;
        ctx.save(); ctx.globalAlpha = fade;
        for (let ax = 0; ax < FW; ax++) {
            const wx = cam.ox + (ax + 0.5) / D, h = U.hAt(g, wx), y = h > H ? FH : Math.round(pin + (h - hmin) * D * c);
            const hy = Math.round(pin - 10 - 4 * c + hillY(S, wx * 1.6) * c);                   // the far range, above and behind
            if (T && T.done) {
                if (hy < y && hy < FH) ctx.drawImage(T.hills, ax, 0, 1, Math.min(HILL_H, Math.min(y, FH) - hy), ax, hy, 1, Math.min(HILL_H, Math.min(y, FH) - hy));
                if (y < FH) ctx.drawImage(T.near, ax, 0, 1, Math.min(FAR_H, FH - y), ax, y, 1, Math.min(FAR_H, FH - y));
            } else if (y < FH) { ctx.fillStyle = (S.GRD || RP.STONE).hex[1]; ctx.fillRect(ax, y, 1, FH - y); }
        }
        ctx.restore();
        const lp = lightAt(G), lx = (lp.x - cam.ox) * D, ly = Math.round(pin + (lp.y - hmin) * D * c) - 1;
        if (lx < TOWER || lx > FW || ly >= FH) return false;
        const f = P.framer(ctx, FW, FH);
        if (G.mark === 'colony' || G.mark === 'machines') [-14, -7, 9, 17].forEach((dx, i) => {          // their other lamps, small on the far ground
            const x = Math.round(lx + dx * c * 1.4), wx = cam.ox + (x + 0.5) / D, h = U.hAt(g, wx), y = Math.round(pin + (h - hmin) * D * c) - 1;
            if (h > H || y >= FH || x < TOWER) return;
            if (G.mark === 'colony') { if (i !== 2) f.px(x, y, RP.AMBER.hex[i % 2 ? 3 : 4]); }
            else if ((now % 1000) < 140) f.px(x, y, '#e1f6fb'); else f.px(x, y, A.R.LAMP.hex[2]);
        });
        return A.drawLight(f, G.mark, lx, ly, now, { night, cloud: 0.4, out: o && o.out, burn: o && o.burn });
    }

    /** The shuttle, its flames, and the crew stepping out; after a crash, the wreck. o: { pic, nozzles, brown, sputter, crash } */
    function drawShuttle(ctx, G, s, now, o) {
        o = o || {};
        const pic = o.pic || G.main;
        CV = pic.V;
        const f = P.framer(ctx, CV.w, CV.h), Ls = G.S.Ls || 1, rim = !!s.grade && G.directSun;   // the sun's edge only once it stands in direct sun
        if (s.grade === 'crash') { wreckArt(ctx, G, s, now, o.crash || {}); return; }
        if (s.crew && window.LanderCrew) window.LanderCrew.drawBehind(ctx, s.crew, G.g, now, CV, G.S);
        (o.nozzles || []).forEach(([nx, ny]) => { const [ax, ay] = toA(nx, ny); A.plume(f, ax, ay, CV.d, 1, o.sputter); });
        const [ax, ay] = toA(s.x, s.y);
        A.shuttle(ctx, CV.d, ax, ay, Ls, { cabin: true, rim, fold: o.fold == null ? 1 : o.fold });
        if (o.brown > 0) brownout(f, G, s, now, o.brown);
        if (s.crew && window.LanderCrew) window.LanderCrew.drawFront(ctx, s.crew, G.g, now, CV, G.S);
    }
    /** Dunes: below 16 px the thrusters raise a wall of dust round the shuttle. */
    function brownout(f, G, s, now, k) {
        const g = G.g, ground = g.heights[Math.max(0, Math.min(W - 1, Math.round(s.x)))], rp = G.S.GRD || RP.DUST, st = 1 / CV.d, d = CV.d, ox = CV.ox, oy = CV.oy;
        for (let dy = -12; dy <= 2; dy += st) for (let dx = -22; dx <= 22; dx += st) {
            const q = (dx / 22) ** 2 + ((dy + 2) / 12) ** 2;
            if (q > 1) continue;
            const n = hash((Math.round(dx * 2 + now / 60)) & 255, (Math.round(dy * 2 - now / 90)) & 255, 7);
            const ax = (s.x + dx - ox) * d, ay = (ground + dy - oy) * d;
            if (n * (1 - q) * 1.7 * k > threshold(Math.round(ax), Math.round(ay))) f.tone(ax, ay, rp, 0.3 + 0.35 * n);
        }
    }
    /** A crash: the flash, the pieces coming to rest, then our shuttle broken on its side (a leg snapped, a scorch under it,
        slow smoke, an ember), and the two climbing out: one lies hurt, the other kneels by them, then helps them away, the
        hurt one limping. c: { hurt, helper, mild } (ids; mild: no suits). */
    function wreckArt(ctx, G, s, now, c) {
        const f = P.framer(ctx, CV.w, CV.h), age = now - s.endedAt, t = age / 1000, d = CV.d, g = G.g;
        const ground = U.hAt(g, s.x), side = crashSide(s);
        const [fx, fy] = toA(s.x, s.y + 7), fx0 = fx, fy0 = fy;
        if (age < 120) {                                                          // the impact: a short lift of the light round it and a small hot core (never a lamp)
            const k = 1 - age / 120;
            f.glow(fx0, fy0, Math.round(3.5 * d), A.R.STEAM, 1.2 * k);
            for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI - Math.PI + (hash(i, 3, 61) - 0.5) * 0.5, r = (4 + 14 * hash(i, 4, 61)) * d * (0.4 + age / 200); f.px(fx0 + Math.cos(a) * r * 1.6, fy0 + Math.sin(a) * r * 0.45, i % 3 ? A.R.STEAM.hex[3] : A.R.STEAM.hex[4], Math.max(1, Math.round(d / 3)), 1); }   // sparks and grit thrown sideways
        }
        if (age < 420) A.puffs(f, Math.round(fx0), Math.round(fy0 + 2 * d), now, { n: 8, h: 6 * d, rate: 0.9, ramp: G.S.GRD || RP.STONE, wind: (s.vx >= 0 ? 1 : -1) * 2.4, big: d / 1.6, a: 0.7 * (1 - age / 420) });   // dust kicked sideways
        if (age > 160) {
            for (let dx = -12; dx <= 12; dx += 1 / d) {                            // the scorch it left
                const q = (dx / 12) ** 2, top = U.hAt(g, s.x + dx), ax = Math.round((s.x + dx - CV.ox) * d), ay = Math.round((top - CV.oy) * d);
                for (let r = 0; r < Math.max(1, d * 0.75); r++) if (threshold(ax, ay + r) < (1 - q) * 0.95) f.px(ax, ay + r, INK);
            }
            const [bx, by] = toA(s.x - side * 2, ground - SH_BELL - 2.4);
            A.shuttle(ctx, d, bx, by, side, { lean: side * 1.35, broken: true });
            const [ex, ey] = toA(s.x + side * 1.5, ground - 2);                   // what still burns
            f.glow(Math.round(ex), Math.round(ey), Math.round((1.6 + Math.sin(age / 90) * 0.3) * d), RP.AMBER, 0.4 + 0.12 * Math.sin(age / 70));
            A.puffs(f, Math.round(ex), Math.round(ey) - d, now, { n: 7, h: 22 * d, rate: 0.16, ramp: RP.STONE, wind: Math.sign(g.wind || 0) * 1.4, big: d / 2.2, a: 0.55 });
        }
        for (let i = 0; i < 14; i++) {                                           // the pieces: thrown out, then lying where they fell
            const angle = i * 2.4, speed = 14 + (i * 7) % 18, tt = Math.min(t, 0.75), px = s.x + Math.cos(angle) * speed * tt;
            const flyY = s.y + 4 - Math.abs(Math.sin(angle)) * speed * tt + 30 * tt * tt, py = Math.min(flyY, U.hAt(g, px) - 0.5), [ax, ay] = toA(px, py);
            if (i % 3 === 0) f.px(ax, ay, RP.HULL.hex[2], Math.max(1, Math.round(d * 0.75)), Math.max(1, Math.round(d * 0.5)));
            else if (t < 0.9) f.tone(ax, ay, A.R.STEAM, Math.max(0.2, 0.95 - t), 1, 1);
        }
        if (t > 0.9 && window.MiniCrew && c.hurt) crashCrew(ctx, G, s, t, c, side);
    }
    const SH_BELL = A.SH.BELL;
    const crashSide = s => (s.crashSide != null ? s.crashSide : (s.crashSide = s.vx >= 0 ? 1 : -1));
    /** Which way from x the ground is easier to walk (less climbing over the next 16 px); pref wins a tie. */
    function flatter(g, x, pref) {
        const climb = dir => { let worst = 0; const h0 = U.hAt(g, x); for (let k = 2; k <= 16; k += 2) { const h = U.hAt(g, x + dir * k); if (h > H || x + dir * k < 2 || x + dir * k > W - 3) return 99; worst = Math.max(worst, h0 - h); } return worst; };
        const a = climb(pref), b = climb(-pref);
        return b + 1.5 < a ? -pref : pref;
    }
    /** Where to look after a crash: between the broken shuttle and the two climbing out of it. */
    function crashFocus(G, s) { const away = flatter(G.g, s.x, -crashSide(s)), x = s.x + away * 8; return { x, y: U.hAt(G.g, x) - 6 }; }
    function crashCrew(ctx, G, s, t, c, side) {
        const MC = window.MiniCrew, g = G.g, d = CV.d, away = flatter(g, s.x, -side), h = 6.4 * d, light = (G.S.Ls || 1) < 0 ? -1 : 1, suit = !c.mild;
        const walk = Math.max(0, t - 2.0), x0 = s.x + away * 9, hurtX = x0 + away * (3 + walk * 4.2), helpX = hurtX + away * 3.2;
        const at = x => { const [ax, ay] = toA(x, U.hAt(g, x)); return [ax, ay]; };
        if (walk <= 0) {
            const [hx, hy] = at(x0 + away * 2), [kx, ky] = at(x0 + away * 5.5);
            MC.small(ctx, c.hurt, hx, hy, { h, pose: 'lie', facing: away, suit, light });
            MC.small(ctx, c.helper, kx, ky, { h, pose: 'kneel', facing: -away, suit, light });
            return;
        }
        const [hx, hy] = at(hurtX), [px, py] = at(helpX), limp = Math.abs(Math.sin(walk * 5)) * d * 0.6;
        MC.small(ctx, c.helper, px, py, { h, pose: 'walk', t: walk * 1000, facing: away, suit, light });
        MC.small(ctx, c.hurt, hx, hy + limp, { h, pose: 'walk', t: walk * 450, facing: away, suit, light });
    }

    window.LandingGround = Object.freeze({ V, D, OX, OY, W, H, LADDER, prepare, urgent, freeLadder, closeUp, draw, drawShuttle, farGround, groundTopY, crashFocus, spot, levelNear, lightAt, toA, levelStretches, markOf, SIGN, MARK });
})();
