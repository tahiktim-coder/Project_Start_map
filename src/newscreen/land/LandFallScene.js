/* ═══ Silent Exodus · new screen (?new=1) · land/LandFallScene.js: THE METEOR in the game (PR #32) ═══
   Part of LandFall.js (the copy of prototypes/landing-meteor/landing.js: its header has the plan and the GAME: marks),
   split off it: the pictures. The orbit and the globe (§6), the release (the push-in, the flare's streak, the reveal), the
   shuttle in the fall, the one picture of the fall and the landing (renderScene, §8: the sky, the far air, the land, the
   deck, what tears past), the field and the shuttle on it after the hand-off, the warm-up's first draws.
   The split (2026-11-03, the house's 800-line limit; the code moved as it was, nothing in it changed but the names that
   cross between the three files): it loads after LandFallFlight.js (whose names it reads from window.LandFallParts) and before LandFall.js,
   which hands it the art canvas's context (setCtx) and draws with it each frame.
*/
(function () {
    'use strict';
    const Z = window.LandFallParts;
    if (!Z) return;                                                          // (LandFallFlight.js did not start: the game keeps LanderGame)
    const { O, world, A, P, FW, FH, find, S, LG, I, lerp, D_LAND, FLARE_FROM, RP, FADE_S, smooth, RELEASE_R, REL_DX, REL_Y, V_CALM, V_FAST, SH,
        sputterOf, CATCH_FLAME_S, MA, clamp01, lightVisible, ML, DECK_CLIP, VEIL_FOOT, TOWER, THIN_SHARE, FADE_FULL, FAINT_LIGHT, BLOOM_S, LF,
        VEIL_H, VEIL_ROWS, VEIL_MAX, VEIL_RISE, hash, CEIL_IN, RUN, fallLook, shakeK, lightOut, flareBurn, shuttleWorld, landView } = Z;
    let ctx = null;                                                          // (the split) the art canvas's context: LandFall.js sets it (setCtx)

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 6. Orbit: the world as the glass showed it, the chosen find's light on it (GAME: nothing to choose: the bridge chose)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function findXY(w, f) { return [O.x + f.uv[0] * O.r, O.y + f.uv[1] * O.r]; }   // GAME: the find's own place (WorldFinds.js at)
    const warmSeen = new Map();
    function warmAt(w, fd, gl, x, y) {
        const key = w.id + ':' + fd.id + ':' + fd.kind;                         // GAME: by the find's id
        if (warmSeen.has(key)) return warmSeen.get(key);
        if (!gl.done || !gl.cpu) return false;
        let r = 0, b = 0;
        const cx = Math.round(x - O.x + gl.half), cy = Math.round(y - O.y + gl.half);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((cy + dy) * gl.size + cx + dx) * 4; r += gl.cpu[i] || 0; b += gl.cpu[i + 2] || 0; }
        const warm = r > b + 9 * 30 && r > 9 * 70;
        warmSeen.set(key, warm);
        return warm;
    }
    function globeLum(gl) {
        if (!gl.done || !gl.cpu) return null;
        return (x, y) => {
            const cx = Math.round(x - O.x + gl.half), cy = Math.round(y - O.y + gl.half);
            if (cx < 0 || cy < 0 || cx >= gl.size || cy >= gl.size) return 0;
            const i = (cy * gl.size + cx) * 4;
            return 0.3 * gl.cpu[i] + 0.59 * gl.cpu[i + 1] + 0.11 * gl.cpu[i + 2];
        };
    }
    function drawOrbit(now) {
        const w = world(), sky = A.orbitSky(w.sector), gl = A.globe(w, 87), f = P.framer(ctx, FW, FH);
        ctx.drawImage(sky.canvas, 0, 0);
        P.twinkle(f, sky.stars, now);
        if (sky.sky && sky.sky.live) { try { sky.sky.live(ctx, now, 0); } catch (e) { /* the still sky is enough */ } }
        drawGlobe(gl, O.x, O.y, 1, now, w);
        const fd = find(), G = S.G || S.G0, [x, y] = findXY(w, fd), mark = G ? G.mark : LG.markOf(fd, I.GROUND_OF[w.type] || 'rock', w.atmosphere);   // GAME: the chosen find's light only
        const burning = S.phase === 'release' && S.flareAt && S.clock >= S.flareAt;
        A.drawLight(f, mark, x, y, now, { night: fd.tod === 'night', scale: 1, pre: mark === 'flare' && !burning, orbit: true, chosen: S.phase === 'orbit', warm: warmAt(w, fd, gl, x, y), groundLum: globeLum(gl) });
    }
    function drawGlobe(gl, x, y, scale, now, w) {
        if (!gl.done) return;
        if (scale === 1) ctx.drawImage(gl.canvas, Math.round(x - gl.half), Math.round(y - gl.half));
        else ctx.drawImage(gl.canvas, Math.round(x - gl.half * scale), Math.round(y - gl.half * scale), Math.round(gl.size * scale), Math.round(gl.size * scale));
        if (scale === 1 && window.NSWorlds) { try { window.NSWorlds.live(P.framer(ctx, FW, FH), w.node || null, x, y, gl.r, now, { L: w.L || A.LW, sector: w.sector, type: w.type, seed: w.seed }); } catch (e) { /* still */ } }   // GAME: the node (the glass's world)
    }
    const lightKind = G => (!G ? 'none' : G.mark);
    /** The polish round: the shuttle's sprites the release will ask for (its size and lean as it leaves the clamp), baked ahead
        one per queue slot. */
    let warmC = null;
    function warmRelease() {
        if (!warmC) { const c = document.createElement('canvas'); c.width = 4; c.height = 4; warmC = c.getContext('2d'); }
        const look = fallLook(), seen = new Set(), Ls = S.G.S.Ls || 1;
        for (let q = 0; q <= 1.0001; q += 0.01) {
            const d = lerp(1, S.cam.d, q * q), dq = Math.abs(d - D_LAND) < 0.06 ? D_LAND : Math.max(1, Math.round(d * 4) / 4), lean = Math.round(look.lean * q / 0.05) * 0.05, key = dq + ':' + lean;
            if (seen.has(key)) continue;
            seen.add(key);
            A.later(() => A.shuttle(warmC, dq, -999, -999, Ls, { cabin: true, rim: false, fold: 0, lean }), 'release', true, 'sprite');
        }
    }
    function flareStreak(F, k, fx, fy, now) {
        const at = q => [lerp(FLARE_FROM[0], fx, q), lerp(FLARE_FROM[1], fy, q) - Math.sin(q * Math.PI) * 30];   // GAME: from our ship off the frame (no clamp, no puff of smoke at it)
        if (k >= 1) { const a = 1 - Math.min(1, (k - 1) / 0.25); if (a > 0) F.glow(fx, fy, Math.round(5 + 4 * (1 - a)), RP.RED, 0.7 * a); return; }
        for (let i = 1; i <= 14; i++) {
            const q = k - i * (0.018 + 0.006 * P.hash(i, 3, 17)); if (q <= 0) break;
            if (P.hash((i * 7 + Math.floor(now / 70)) & 255, 5, 17) < 0.3) continue;
            const [x, y] = at(q), j = (P.hash(i, Math.floor(now / 90) & 255, 19) - 0.5) * 1.6;
            F.tone(x + j, y + j * 0.5, RP.RED, (0.8 - i * 0.05) * (0.7 + 0.3 * P.hash(i, 9, 17)));
        }
        const [hx, hy] = at(k), fl = 0.8 + 0.2 * P.hash(Math.floor(now / 80) & 255, 7, 17);
        F.glow(hx, hy, 3, RP.RED, 0.55 * fl); F.px(hx, hy, fl > 0.94 ? '#ffd2c8' : RP.RED.hex[4]);
    }
    /** The release: the shuttle leaves the clamp and falls away toward the world; the view pushes in on the find (the globe
        drawn from the next larger of its baked sizes, never blown up) while the shuttle, falling ahead of us, grows to its
        place in the fall; the fall's air comes in round the find's light, outward, pixel by pixel through the grain. */
    function drawRelease(now) {
        if (tOn) tLast = performance.now();
        const t = S.clock - S.releaseAt, w = S.w, f = S.f, [fx, fy] = findXY(w, f), F = P.framer(ctx, FW, FH), RS = S.releaseS, quick = RS < 2, ST = S.streakS;
        const fadeS = quick ? 0.35 : FADE_S, lead = quick ? (S.flareAt ? ST : 0.2) : 1.3, push = smooth(lead, RS - fadeS * 0.3, t), leave = quick ? Math.min(0.15, lead * 0.5) : 0.8;
        if (push <= 0) {
            drawOrbit(now);
            if (S.flareAt && t < ST + 0.25) flareStreak(F, t / ST, fx, fy, now);
        } else {                                                                 // the view pushes in on the find
            const sky = A.orbitSky(w.sector);
            ctx.drawImage(sky.canvas, 0, 0);
            const r = O.r * Math.pow(RELEASE_R[RELEASE_R.length - 1] / O.r, push), tx = lerp(fx, S.light0.x, push), ty = lerp(fy, S.light0.y, push);
            const gx = tx - (fx - O.x) * r / O.r, gy = ty - (fy - O.y) * r / O.r;
            const gl = RELEASE_R.map(rr => A.globe(w, rr)).find(g => g.done && g.r >= r - 0.5) || A.globe(w, O.r);
            drawGlobe(gl, gx, gy, Math.min(1, r / gl.r), now, w);
            A.drawLight(F, lightKind(S.G), tx, ty, now, { night: S.G.tod === 'night', orbit: true, lit: true, warm: warmAt(w, f, A.globe(w, 87), fx, fy) });
        }
        if (tOn) { tick('relSky'); }
        const from = RS - fadeS;
        if (t > from) { renderScene(now, { into: true, noShuttle: true }); tLast = performance.now(); revealFrom(off().canvas, S.light0.x, S.light0.y, smooth(from, RS, t)); tick('relReveal'); }
        // the shuttle: on the clamp, then away and down, growing as we chase it, turning bell-first into the air
        const go = smooth(leave, RS, t), d = lerp(1, S.cam.d, go * go), look = fallLook(), lean = Math.round(look.lean * go / 0.05) * 0.05;
        const bx = lerp(S.camShX + REL_DX, S.camShX, Math.pow(go, 0.8)) + Math.sin(go * 3) * 4 * (1 - go), by = lerp(REL_Y, S.camShY, Math.pow(go, 1.15));   // GAME: in from the frame's top
        drawFallShuttle(ctx, bx, by, d, Object.assign({}, look, { lean, fold: 0 }), now, { keys: {}, heat: go > 0.75 ? (go - 0.75) * 0.6 : 0, shake: 0, release: true });
        S.bellNow = [bx, by, d];                                                // GAME: no hull beside the picture
        tick('relShuttle');
    }
    let rev = null;
    /** src over the frame where it has come in: outward from (cx, cy) as k goes 0 → 1, per art pixel through the Bayer grain
        (a soft, uneven front: no blocks, no rectangle). */
    /** The polish round: the reveal's grain noise, once (it does not depend on where the light is). */
    let revN = null;
    function revNoise() { if (!revN) { revN = new Float32Array(FW * FH); for (let y = 0, i = 0; y < FH; y++) for (let x = 0; x < FW; x++, i++) revN[i] = (P.vnoise(x / 23, y / 17, 5) - 0.5) * 0.2; } return revN; }
    /** The reveal's distance map round (cx, cy), rows y0..y1 (done ahead in strips at the click: the polish round). */
    function revRows(cx, cy, y0, y1) {
        if (!rev) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d'); rev = { c, g, img: g.createImageData(FW, FH), dist: new Float32Array(FW * FH), at: '', rows: 0 }; }
        const at = Math.round(cx) + ':' + Math.round(cy);
        if (rev.at !== at) { rev.at = at; rev.rows = 0; }
        const md = Math.hypot(Math.max(cx, FW - cx), Math.max(cy, FH - cy) * 1.2), N = revNoise();
        for (let y = Math.max(y0, rev.rows); y < Math.min(FH, y1); y++) for (let x = 0, i = y * FW; x < FW; x++, i++) rev.dist[i] = Math.hypot(x - cx, (y - cy) * 1.2) / md + N[i];
        rev.rows = Math.max(rev.rows, Math.min(FH, y1));
    }
    function revealFrom(src, cx, cy, k) {
        if (k <= 0) return;
        if (k >= 1) { ctx.drawImage(src, 0, 0); return; }
        revRows(cx, cy, 0, FH);
        const BAND = 0.32, T = k * (1 + BAND + 0.1) - 0.1, d = rev.img.data, dist = rev.dist;
        for (let y = 0, i = 0; y < FH; y++) for (let x = 0; x < FW; x++, i++) d[i * 4 + 3] = P.threshold(x, y) < (T - dist[i]) / BAND ? 255 : 0;
        rev.g.globalCompositeOperation = 'copy'; rev.g.putImageData(rev.img, 0, 0);
        rev.g.globalCompositeOperation = 'source-in'; rev.g.drawImage(src, 0, 0); rev.g.globalCompositeOperation = 'source-over';
        ctx.drawImage(rev.c, 0, 0);
    }
    let offC = null;
    function off() { if (!offC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; offC = c.getContext('2d'); offC.imageSmoothingEnabled = false; } return offC; }
    /** The shuttle in the fall at (bx, by) (its bell on screen), d art px per world px. */
    function drawFallShuttle(pc, bx, by, d, look, now, o) {
        const dq = Math.abs(d - D_LAND) < 0.06 ? D_LAND : Math.max(1, Math.round(d * 4) / 4), F = P.framer(pc, FW, FH), e = S.e, heat = o.heat != null ? o.heat : (e.H + (S.hev || 0)) / 100, spd = smooth(V_CALM, V_FAST + 80, look.v);   // dq: at the landing's scale, the very sprite the landing draws
        const jit = o.shake || 0, jx = jit ? Math.round((Math.random() - 0.5) * 2 * jit) : 0, jy = jit ? Math.round((Math.random() - 0.5) * 2 * jit) : 0;
        bx = Math.round(bx + jx); by = Math.round(by + jy);
        const top = by - SH.BELL * dq, keys = o.keys || {}, lit = e.fuel > 0, sp = sputterOf(e.fuel), po = { lean: look.lean }, dn = [-Math.sin(look.lean), Math.cos(look.lean)];
        const catching = S.catchAt != null && S.clock - S.catchAt < CATCH_FLAME_S;
        const fire = side => { const [px, py] = A.podAt(dq, side, po); MA.flame(F, bx + px, top + py, dn[0], dn[1], dq, catching ? 1.6 : 1, sp); };
        const pl = { x: bx, y: by, dx: dn[0], dy: dn[1], ux: look.ux, uy: look.uy, d: dq, heat, spd: spd * (S.w.atm > 0 ? 1 : 0), t: now };
        MA.plasmaBack(F, pl);
        if (lit && (keys.up || keys.right || catching)) fire(-1);
        if (lit && (keys.up || keys.left || catching)) fire(1);
        A.shuttle(pc, dq, bx, top, S.G.S.Ls || 1, { cabin: true, rim: false, fold: look.fold, lean: look.lean });
        if (S.tileAt && S.clock - S.tileAt < 1.6) { const q = (S.clock - S.tileAt) / 1.6; F.tone(bx - look.ux * q * 160 + 6, by - look.uy * q * 160 - 8 + q * q * 30, RP.HULL, 0.7, 3, 2); }   // a heat tile torn off, tumbling back
        if (!o.release) MA.rattle(F, bx, by - 4 * dq, dq, clamp01(shakeK().amp / 4), now);
        MA.plasmaFront(F, pl);
        S.shAX = bx;
    }
    /** Round 3: does the find's light show from up here (life by day has none; the machines' only from 280 px over the deck). */
    const lightShows = () => lightVisible() && !(S.G.mark === 'machines' && S.e && S.e.a > 280) && !lightOut();
    /** How much the light's break is lit in the light's own colour (the machines' fades in over 0.4 s once they show). */
    function lightOnK() {
        if (!lightVisible() || lightOut()) return 0;
        if (S.G.mark === 'machines') return S.machinesAt == null ? 0 : clamp01((S.clock - S.machinesAt) / 0.4);
        return S.G.mark === 'flare' ? flareBurn() : 1;
    }
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 8. The one picture: sky, far air, the field under the deck, the deck, what tears past, the shuttle
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** The polish round, test only (off by default): the frame's work by part (LandingProto.timing), and parts left out (LandingProto.skip). */
    let tOn = false, tLast = 0;
    const tAcc = new Map(), skip = {};
    const tick = n => { if (!tOn) return; const t = performance.now(); if (!tAcc.has(n)) tAcc.set(n, []); tAcc.get(n).push(t - tLast); tLast = t; };
    function renderScene(now, o) {
        o = o || {};
        if (tOn && !o.probe) tLast = performance.now();
        const pc = o.pc || (o.into ? off() : ctx), G = S.G, E = S.E, M = S.M, w = S.w, e = S.e, F = P.framer(pc, FW, FH), falling = S.phase === 'fall' || S.phase === 'release';
        const cam = S.cam, d = cam.d, sk = shakeK(), probe = o.probe || null;
        const sh = o.into || probe ? [0, 0] : [Math.round((Math.random() - 0.5) * 2 * sk.amp), Math.round((Math.random() - 0.5) * 2 * sk.amp)];
        const toX = wx => (wx - cam.x) * d + sh[0], toY = wy => (wy - cam.y) * d + sh[1];
        const a = falling ? e.a : -9999, a01 = clamp01(a / e.a0), sw = shuttleWorld(), baseS = toY(G.cloudBase);
        if (falling && E.air && a <= ML.K.A_HAND && M && M.deep && M.deep.done) pc.drawImage(M.deep.canvas, 0, 0);   // the fix round: in the deck, the air down a shaft is dim, uneven, paler below (never a flat panel)
        else { pc.fillStyle = falling && E.air && a <= ML.K.A_HAND ? (E.cloud || RP.HAZE).hex[1] : P.INK; pc.fillRect(0, 0, FW, FH); }   // round 3: in the deck the clear air of a shaft is dim cloud-lit air, never a black void
        const V = falling ? (S.view = landView()) : null;
        if (V && !S.fieldOn && V.h <= ML.K.H1 && V.trueY <= V.Yg + 0.5) S.fieldOn = true;   // (the fix round: the field takes over once the camera's own ground row has come up to the far land's: no dip, no pop)
        const far = !!(V && !S.fieldOn);                                          // far: the land by the projection (else the field 1:1, as the landing draws it)
        const topS = a > 0 && V ? V.nearTop + sh[1] : toY(S.topY), night = G.tod === 'night' ? 0.62 : 1;
        const shX = sw ? toX(sw.x) : 0, shY = sw ? toY(sw.y + SH.BELL) : 0, v = sw ? sw.v : 0, ux = falling ? e.vx / (v || 1) : 0, uy = falling ? e.vy / (v || 1) : 1;
        let shown = false;
        // 1. while the deck's top is in the picture: the sky, the limb and the far sea (a thin band under the horizon)
        const hz = V ? V.hz : lerp(150, 236, Math.pow(a01, 0.75));
        if (topS > -40 && !skip.sky) {
            const sky = A.orbitSky(w.sector);
            if (!(w.atm > 0 && MA.skyAt(pc, M, Math.pow(1 - a01, 0.8)))) { pc.drawImage(sky.canvas, Math.round(sh[0] * 0.2), Math.round(sh[1] * 0.2)); P.twinkle(F, sky.stars, now); if (falling) hideSun(pc, sh); }   // the sky: the air thickens as we sink into it (the fix round: no false sun in the fall)
            MA.far(pc, E, { M, z: 1 - a01, hz, spread: 0.3 + 2.4 * Math.pow(a01, 1.4), scroll: S.flownX || 0, shake: sh });
            if (G.kindName === 'storm') A.stormFlash(F, now, hz);
        }
        if (!o.probe) tick('sky');
        // 2. the land: far below by the one projection (from the first frame), or under the deck the field 1:1
        if (far && !skip.land) S.landBox = ML.drawLand(pc, G, V, { shake: sh, probe, airless: !E.air, anchorY: S.anchorY, fieldOn: S.fieldOn, clipTop: e.deck > 0 && a <= 0 ? toY(S.topY) + DECK_CLIP : null });
        if (far && !skip.land && falling && E.air && e.deck > 0 && a <= 0 && S.landBox && !probe) airVeil(pc, G, V.Yg - VEIL_FOOT * V.sigL + sh[1], S.landBox.clipY);   // (the final fix round) its far hills veiled in the air
        const lift = S.landLift && S.landAt != null ? S.landLift * Math.exp(-(S.clock - S.landAt) / 0.12) : 0;   // (the fix round: if the hand-off came before the rows met, the field eases the last px)
        const fieldAt = () => { const Vg = G.V, ax = sw ? sw.x : cam.x + FW / 2 / d, ay = S.anchorY != null ? S.anchorY : S.groundY; /* pinned where the far land was, in the landing too (the fix round: no hop at the hand-off) */ return [Math.round(toX(ax) - (ax - Vg.ox) * D_LAND), Math.round(toY(ay) - (ay - Vg.oy) * D_LAND + lift)]; };
        if (baseS < FH + 4 && !far) {
            const [fx0, fy0] = fieldAt();                                         // the field 1:1, pinned at the ground under the shuttle (never resized)
            if (probe) { const mf = G.mainFar; if (mf && mf.lit) ML.keyed(pc, probe, c => c.drawImage(mf.lit, Math.round(fx0 + (mf.V.ox - G.V.ox) * D_LAND), fy0)); else { pc.fillStyle = probe; pc.fillRect(fx0, fy0, G.V.w, G.V.h); } }   // (the polish round: the land itself, by the far land's own sky-cut copy, never the field's sky)
            else { pc.save(); pc.setTransform(1, 0, 0, 1, fx0, fy0); drawField(pc, now, null, falling ? fallProxy() : null, true); pc.restore(); }
            const lp = LG.lightAt(G), lx = toX(lp.x), ly = toY(lp.y);
            shown = G.lightDrawn && lx > TOWER && lx < FW && ly > 0 && ly < FH;
            if (!E.air && baseS > -20) fadeTop(pc, fieldAt()[1]);                 // the field's own top, where it is drawn
            else if (e.deck > 0) ceilingIn(pc, M, baseS, falling && sw ? ceilK(sw) : 1);   // under the deck: its floor receding to the horizon (still dissolving in while we fall: the final fix round, no pop at the switch)
        } else if (far && e.deck > 0 && baseS < FH + 4 && sw) {                 // the deck's floor over the land far below (the fix round: never through a shaft from inside the deck; it dissolves in as we come out under it)
            ceilingIn(pc, M, baseS, ceilK(sw));
        }
        if (!o.probe) tick('land');
        // 3. the deck close: its floor, and from A_HAND over its top down its billows and body; the shafts through it
        const shafts = falling && V && E.air && e.deck > 0 ? litShafts(ML.shaftCols(V, S.breaks, cam), sh) : null;
        if (E.air && e.deck > 0 && baseS > -12 && !skip.deck) {
            MA.virga(F, baseS, cam.x * d - sh[0], now, E.cloud || A.mute(RP.DUST), E.airR || RP.ICE, 1);   // rain or snow hanging from the floor
            MA.deck(pc, E, M, { thin: falling && a <= 0 ? THIN_SHARE * e.deck * d : 0, fadeIn: falling && a > 0 && a <= ML.K.A_HAND ? 1 - a / ML.K.A_HAND : 1, top: topS, base: baseS, ox: cam.x * d - sh[0], oy: cam.y * d - sh[1], k: 1, t: now, shafts, near: !falling || a <= ML.K.A_HAND, night, glow: lightOnK() > 0.5 && lightShows() ? ML.LIGHT_RAMP[lightKind(G)] : null, glowAt: V ? [V.P.x + sh[0], V.P.y + sh[1]] : null, landTop: V && far ? V.Yg + (Math.min(S.groundY, S.lightPt.y + 2) - FADE_FULL - 10 - S.anchorY) * V.sigL + sh[1] : null });   // its pictures 1:1 (never resized); landTop: the land picture's own top (the mist inside a shaft thins out there)
        }
        if (!o.probe) tick('deck');
        // 4. above the deck: its top far below, torn (the cover), dissolving into the deck close over the last A_HAND px
        if (falling && a > 0 && E.air && !skip.cover) { const ms = ML.drawCover(pc, G.cover, V, { deckOx: (cam.x * d - sh[0]) * 0.95, deckOy: cam.y * d - sh[1], E, night, lightKind: lightKind(G), lightOn: lightOnK(), shake: sh, probe: !!probe, landTop: V.Yg + (Math.min(S.groundY, S.lightPt.y + 2) - FADE_FULL - S.anchorY) * V.sigL, landBox: far && !skip.land ? S.landBox : null }); if (!probe) S.passMs = ms; }
        if (!o.probe) tick('cover');
        // 5. the find's light, crisp: through its break, a smudge under the cover, a glow up through the deck when blind
        if (falling && far && !o.into && lightShows()) {
            const deck = e.deck > 0 && a <= 0, cl = deck ? (inShaftCol(shafts, V.P.x + sh[0], V.P.y + sh[1], topS, baseS) ? 0 : 0.85) : E.air && !ML.openAt(G.cover, V, V.P.x, V.P.y) ? 0.6 : 0;   // (the fix round: in the deck, clear when the light lies in a shaft as drawn)
            if (!probe && cl < 0.7 && !lightOut()) {                              // (the polish round) the find's light keeps a soft steady glow round it, larger with no air (there it is the only thing to aim at)
                const GL = ML.K.GLOW, air = !!E.air, faint = FAINT_LIGHT.includes(lightKind(G)), rad = 2 * Math.round((GL.R0 + GL.R1 * Math.sqrt(V.sL) + (air ? 0 : GL.AIRLESS_R) + (faint ? GL.FAINT_R : 0)) / 2), rp = ML.LIGHT_RAMP[lightKind(G)] || RP.RED, hc = MA.halo(rp, rad, (faint ? GL.FAINT_PEAK : air ? GL.PEAK : GL.AIRLESS_PEAK) * (cl > 0 ? GL.UNDER : 1));
                pc.drawImage(hc, Math.round(V.P.x + sh[0] - rad), Math.round(V.P.y + sh[1] - rad));
            }
            if (probe) S.lightOpenNow = cl === 0;
            else if (ML.drawLight(F, G, V, { now, night: G.tod === 'night', kind: lightKind(G), cloud: cl, out: lightOut(), burn: flareBurn(), shake: sh })) S.seaLight = true;
            const bq = S.phase === 'fall' && S.fallAt != null ? (S.clock - S.fallAt) / BLOOM_S : 1;   // the fix round: the find's light blooms once as the fall starts (the one warm point: look here)
            if (!probe && bq < 1 && cl < 0.5) MA.glowLit(F, Math.round(V.P.x + sh[0]), Math.round(V.P.y + sh[1]), Math.round(5 + 20 * Math.sqrt(bq)), ML.LIGHT_RAMP[lightKind(G)] || RP.RED, 0.85 * (1 - bq) * (1 - bq), 2);
        }
        if (falling && far && !o.into && !probe && E.air && a > 0 && !lightShows() && !lightOut()) {   // (the polish round) no light to aim at (life by day, the machines before they show): the gap itself glows a little in the air's own light, so the line matches what is on screen
            const GL = ML.K.GLOW, rad = 2 * Math.round((GL.R0 + 2 + 2 * GL.R1 * Math.sqrt(V.sL)) / 2);
            pc.drawImage(MA.halo(E.airR || RP.ICE, rad, GL.GAP), Math.round(V.P.x + sh[0] - rad), Math.round(V.P.y + sh[1] - rad));
        }
        if (falling && !o.into && G.kindName === 'storm' && topS < 0 && baseS >= FH - 10) A.stormFlash(F, now, 30);
        if (!falling && S.s && baseS < FH + 4) {                                 // after the hand-off: the shuttle (or the crew, or the wreck) in front of the sky
            { const [fx0, fy0] = fieldAt(); pc.save(); pc.setTransform(1, 0, 0, 1, fx0, fy0); drawFieldShuttle(pc, now, null); pc.restore(); }
        }
        if (!o.probe) tick('light');
        // 6. what drifts far behind us (above the deck), the air going by, the shuttle, what passes in front of it
        if (falling && sw && a > 0 && !skip.depth) drawDepth(pc, F, now, cam, sh, false, shX, shY, sw);
        if (!o.probe) tick('depthBack');
        if (falling && sw) {
            MA.streaks(pc, E, { sx: sw.x * d, sy: sw.y * d, ux: -ux, uy: -uy, v: v * d, n: Math.round((10 + 46 * smooth(40, V_FAST, v)) * (0.45 + 0.55 * clamp01(LF.rhoAt(Math.max(0, e.a)) * 2.2)) * (w.atm > 0 ? 1 : 0.35)), top: -999, spd: smooth(V_CALM, V_FAST, v), near: [shX, shY, clamp01((e.H + (S.hev || 0) - 40) / 60)] });
            if (!o.probe) tick('streaks');
            if (!o.noShuttle) drawFallShuttle(pc, shX, shY, d, fallLook(), now, { keys: S.keysNow || {}, shake: 0.6 + 1.6 * sk.heat + 0.8 * sk.spd });
            if (!o.probe) tick('shuttle');
            if (!o.into && !skip.depth) drawDepth(pc, F, now, cam, sh, true, shX, shY, sw);
            if (!o.probe) tick('depthFront');
        }
        S.lightDrawn = shown;                                                   // GAME: no hull beside the picture
    }
    let ceilC = null;
    /** The final fix round: the air's haze over the land's far part inside the deck, by its distance above its foot (y1, screen;
        the land's own ground less VEIL_FOOT px): heavier the higher, dithered in white noise (never a band of dots). Baked
        once a place (VEIL_H rows), drawn by its bottom rows only (the same falloff at any height). */
    function airVeil(pc, G, y1, clipY) {
        const E = G.E, Vc = E.veil;
        if (!Vc) { if (!E.veilQueued) { E.veilQueued = true; bakeVeil(E, G.tod === 'night' ? 0.62 : 1, G.tag); } return; }
        const yb = Math.round(y1), h = Math.min(VEIL_H, yb - Math.max(0, Math.floor(clipY)));
        if (h > 2) pc.drawImage(Vc, 0, VEIL_H - h, FW, h, 0, yb - h, FW, h);
    }
    /** (in VEIL_ROWS-row slices, one a queue slot: never a long job in the release or the fall; the last sets E.veil) */
    function bakeVeil(E, night, tag) {
        const c = document.createElement('canvas'); c.width = FW; c.height = VEIL_H;
        const g = c.getContext('2d'), r = E.airR || RP.ICE, top = r.rgb.length - 1;
        for (let y0 = 0; y0 < VEIL_H; y0 += VEIL_ROWS) A.later(() => {
            const img = g.createImageData(FW, VEIL_ROWS);
            for (let y = y0; y < y0 + VEIL_ROWS; y++) { const up = VEIL_H - 1 - y, al = VEIL_MAX * smooth(0, VEIL_RISE, up); for (let x = 0; x < FW; x++) { if (hash(x & 255, y & 255, 213) >= al) continue; const n = P.fbm(x / 60, y / 18, 219, 2), v = (0.2 + 0.1 * n) * night * top, lo = v | 0, k = Math.min(top, lo + (v - lo > P.threshold(x, y) ? 1 : 0)), rgb = r.rgb[k], i = ((y - y0) * FW + x) * 4; img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255; } }
            g.putImageData(img, 0, y0);
            if (y0 + VEIL_ROWS >= VEIL_H) E.veil = c;
        }, tag, true, 'air veil ' + y0);
    }
    /** The underside of the deck coming in as we come out under it (0..1): over the last CEIL_IN px of the deck and on to the
        hand-off (the final fix round: was 16 px, a pop of a third of the frame in two frames on a blind dive). */
    const ceilK = sw => clamp01((sw.y - (S.G.cloudBase - CEIL_IN)) / (CEIL_IN + Math.max(4, S.e ? S.e.under : 10)));
    function ceilingIn(pc, M, baseS, k) {
        if (k >= 1) { MA.ceiling(pc, M, baseS - 6, (S.horizonY - S.cam.y) * S.cam.d); return; }
        if (k > 0) { const t = ceilTmp(); t.clearRect(0, 0, FW, FH); MA.ceiling(t, M, baseS - 6, (S.horizonY - S.cam.y) * S.cam.d); A.dissolve(pc, t.canvas, k); }
    }
    const ceilTmp = () => { if (!ceilC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; ceilC = c.getContext('2d'); } return ceilC; };
    /** The shafts on screen (shaken), each wall lit on the side that faces the light's own shaft (the light's: both). */
    function litShafts(cols, sh) {
        const L = cols.find(q => q.kind === 'light');
        return cols.map(q => Object.assign(q, { cx: q.cx + sh[0], litSide: q.kind === 'light' || !L ? 0 : L.cx > q.cx ? 1 : -1 }));
    }
    /** Is screen point (x, y) in the clear air of one of these shafts (at its row's width)? */
    function inShaftCol(cols, x, y, top, base) {
        if (!cols) return false;
        const q = clamp01((y - top) / Math.max(60, base - top)), qq = q * q * (3 - 2 * q);
        return cols.some(s => Math.abs(x - s.cx) <= s.hwTop + (s.hwBot - s.hwTop) * qq);
    }
    /** An airless world's false sun is put out for the fall (the find's light is the one bright point). Baked once. */
    let sunC = null;
    function hideSun(pc, sh) {
        if (!A.LIGHT) return;
        if (!sunC) {
            const R = 30, c = document.createElement('canvas'); c.width = c.height = 2 * R;
            const g = c.getContext('2d'), img = g.createImageData(2 * R, 2 * R), ink = P.hexRgb(P.INK);
            for (let y = 0; y < 2 * R; y++) for (let x = 0; x < 2 * R; x++) { const k = 1 - smooth(10, R, Math.hypot(x - R, (y - R) * 1.1)); if (P.threshold(x, y) < k) { const i = (y * 2 * R + x) * 4; img.data[i] = ink[0]; img.data[i + 1] = ink[1]; img.data[i + 2] = ink[2]; img.data[i + 3] = 255; } }
            g.putImageData(img, 0, 0); sunC = c;
        }
        pc.drawImage(sunC, Math.round(A.LIGHT[0] - 30 + sh[0] * 0.2), Math.round(A.LIGHT[1] - 30 + sh[1] * 0.2));
    }
    /** What drifts at its own depth along the way down: the cloud torn past (rags on a lattice per depth: far ones slow and
        many, near ones big and quick, a front one crossing over the shuttle about once a second at speed), the deck's own
        rags inside it, the hulls and the storm's cells (front: after the shuttle). */
    const RAG_LAYERS = [
        { p: 0.2, cell: [220, 180], w: 30, prob: 0.5, max: 8 }, { p: 0.34, cell: [200, 160], w: 48, prob: 0.55, max: 8 }, { p: 0.55, cell: [270, 230], w: 90, prob: 0.5, max: 6 },
        { p: 1.6, cell: [520, 900], w: 120, prob: 0.25, max: 2, front: true }, { p: 2.4, cell: [760, 1500], w: 150, prob: 0.18, max: 2, front: true },   // in front: about one a second at speed
    ];
    function drawDepth(pc, F, now, cam, sh, front, shX, shY, sw) {
        const d = cam.d, e = S.e, v = Math.hypot(e.vx, e.vy);
        const at = (wx, wy, p) => [shX + (wx - sw.x) * d * p, shY + (wy - sw.y - SH.BELL) * d * p];
        const L = front ? ragFront : ragBack, R = { cloud: S.E.cloud || A.mute(RP.DUST), air: S.E.airR || RP.ICE, night: S.G.tod === 'night' ? 0.62 : 1 }, mx = -e.vx / (v || 1), my = -e.vy / (v || 1), litSide = (S.G.S.Ls || 1) < 0 ? -1 : 1;
        let any = false;
        L.clear();
        const inDeck = S.E.air && e.deck > 0 && sw.y > S.topY - 30 && sw.y < S.G.cloudBase + 4;
        if (inDeck) for (let j = Math.floor(sw.y / 16) - 4; j <= Math.floor(sw.y / 16) + 6; j++) {   // in the deck: its own rags, torn past
            const fr = hash(j & 255, 3, 77) < 0.4, p = fr ? 1.4 + hash(j & 255, 4, 77) : 0.4 + 0.5 * hash(j & 255, 5, 77);
            if (fr !== front) continue;
            const [x, y] = at(sw.x + (hash(j & 255, 6, 77) - 0.5) * 200 / (d * p), j * 16, p), w = fr ? 90 : 40;
            if (MA.rag(L, { x, y, len: Math.min(3 * w, w + 0.03 * v * d * p), w, ux: mx, uy: my, seed: 200 + (j & 255), front, cloud: R.cloud, air: R.air, night: R.night * 0.8, litSide })) any = true;
        }
        if (S.E.air && sw.y < S.topY + 4) RAG_LAYERS.forEach((Ly, li) => {           // above the deck: the air's own rags, more the thicker the air
            if (!!Ly.front !== front) return;
            const s = d * Ly.p, cw = Ly.cell[0] / (5 * Ly.p), ch = Ly.cell[1] / (5 * Ly.p);
            const i0 = Math.floor((sw.x + (-160 - shX) / s) / cw), i1 = Math.floor((sw.x + (FW + 160 - shX) / s) / cw);
            const j0 = Math.floor((sw.y + SH.BELL + (-240 - shY) / s) / ch), j1 = Math.floor((sw.y + SH.BELL + (FH + 240 - shY) / s) / ch);
            let n = 0;
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
                if (n >= Ly.max) return;                                     // (a safety cap: the lattice keeps them about that few)
                const seed = 31 + li * 53, h = hash(i & 255, j & 255, seed), wy = (j + 0.15 + 0.7 * hash(i & 255, j & 255, seed + 2)) * ch;
                const air = clamp01(0.3 + LF.rhoAt(Math.max(0, S.topY - wy)) * S.e.atm * 1.4);
                if (h > Ly.prob * air) continue;
                const wx = (i + 0.15 + 0.7 * hash(i & 255, j & 255, seed + 1)) * cw, [x, y] = at(wx, wy, Ly.p), w = Ly.w * (d / 5) * (0.7 + 0.6 * hash(i & 255, j & 255, seed + 3));
                if (MA.rag(L, { x, y, len: Math.min(3 * w, w + 0.03 * v * s), w, ux: mx, uy: my, seed: (i * 7 + j * 13) & 255, front, cloud: R.cloud, air: R.air, night: R.night, litSide })) { any = true; n++; S.wispsSeen++; }
            }
        });
        if (any) L.draw(pc);
        const hullAt = h => Math.max(24, Math.round(h.hl * d * h.p / 8) * 8);   // its size on screen, on a few steps (each baked once, drawn 1:1)
        if (!front) {
            S.hulls.forEach(h => { if (h.p >= 1) return; const [x, y] = at(h.wx, h.wy, h.p); if (x > -90 && x < FW + 90 && y > -90 && y < FH + 90) A.drawHull(pc, { x, y: y + Math.sin(now / 1700 + h.bob) * 3, len: hullAt(h), seed: h.seed, angle: h.angle, flip: h.flip, from: h.from, to: h.to }); });
            S.cells.forEach((c, i) => { const [x, y] = at(c.wx, c.wy, 1); if (x > -60 && x < FW + 60 && y > -60 && y < FH + 60) { F.glow(Math.round(x), Math.round(y - 10), Math.round(9 * d), A.R.LAMP, 0.16); A.stormCell(F, x, y, now + c.ph, S.cellsHit.has(i) && S.clock - (S.strikeAt || 0) < 0.4); } });
            return;
        }
        S.hulls.forEach(h => { if (h.p < 1) return; const [x, y] = at(h.wx, h.wy, 1); if (x > -120 && x < FW + 120 && y > -120 && y < FH + 120) A.drawHull(pc, { x, y, len: hullAt(h), seed: h.seed, angle: h.angle, flip: h.flip, from: h.from, to: h.to }); });
    }
    const ragBack = MA.dirtyLayer(FW, FH), ragFront = MA.dirtyLayer(FW, FH);   // (the polish round: only the rows they touch are put)
    /** An airless world: the field's own starry sky fades into the stars above it (no deck to hide the seam). Baked once. */
    let fadeC = null;
    function fadeTop(pc, y) {
        if (!fadeC) {
            const c = document.createElement('canvas'); c.width = FW; c.height = 26;
            const g = c.getContext('2d'), img = g.createImageData(FW, 26), ink = P.hexRgb(P.INK);
            for (let r = 0; r < 26; r++) { const k = 1 - r / 26; for (let x = 0; x < FW; x++) if (P.threshold(x, r) < k) { const i = (r * FW + x) * 4; img.data[i] = ink[0]; img.data[i + 1] = ink[1]; img.data[i + 2] = ink[2]; img.data[i + 3] = 255; } }
            g.putImageData(img, 0, 0); fadeC = c;
        }
        pc.drawImage(fadeC, 0, Math.round(y));
    }
    /** The fall's shuttle as the field sees it (its shadow, its dust): LanderGame's state shape. */
    function fallProxy() {
        const e = S.e, y = S.topY - e.a;
        return { x: e.x, y, vx: e.vx, vy: e.vy, grade: null, keys: { left: false, right: false }, isReleased: true, altitude: S.groundY - (y + I.LANDER_HALF + 3), fuel: e.fuel, hide: true };
    }
    // ── drawing the field (the place under the deck) ──
    function nozzlesOf(s) {
        const out = [], lit = !s.grade && s.fuel > 0;
        if (lit && s.keys.right) out.push([s.x - A.SH.PODS, s.y + A.SH.POD_Y]);
        if (lit && s.keys.left) out.push([s.x + A.SH.PODS, s.y + A.SH.POD_Y]);
        return out;
    }
    /** The place (and, after the hand-off, the shuttle on it) into c, in the picture's own art px. sFall: the fall's shuttle
        as the place sees it (its shadow only: the fall draws the shuttle itself). */
    const hopping = () => !!(S.touch && S.touch.settle && S.touch.settle.hop);   // GAME (the final check): the hop off the site's art (LandFallFlight.js settleOf)
    const nozzlesNow = s => ((S.catchAt != null && S.clock - S.catchAt < CATCH_FLAME_S && !s.grade) || hopping() ? [[s.x - A.SH.PODS, s.y + A.SH.POD_Y], [s.x + A.SH.PODS, s.y + A.SH.POD_Y]] : nozzlesOf(s));   // A.U.R.A.'s catch, or the hop: both burn
    function drawField(c, now, pic, sFall) {
        const G = S.G, s = sFall || S.s, nz = sFall ? [] : nozzlesNow(s);
        LG.draw(c, G, s, now, { pic, nozzles: nz, flash: S.flash > 0, bolt: S.flash > 0 ? S.bolt : null, gust: S.gust, out: lightOut(), burn: flareBurn() });
        return G.lightDrawn;
    }
    /** The shuttle on the place after the hand-off (its flames, the crew walking out, the wreck): over the sky and the deck. */
    function drawFieldShuttle(c, now, pic) {
        const s = S.s, nz = nozzlesNow(s);
        LG.drawShuttle(c, S.G, s, now, { pic, nozzles: nz, brown: S.brown, sputter: sputterOf(s.fuel), crash: S.crash });
        if (!s.grade) S.shAX = (s.x - S.cam.x) * S.cam.d;
    }
    /** The final fix round: the next landing's land pictures, each drawn once (1 px, under the tower) while the orbit shows:
        a picture's first draw is the costly one (its upload), and it must never fall in the fall. One a frame. */
    const warmed = new WeakSet();
    function warmPics() {
        const G = RUN.urgentG;
        if (!G || !G.ladder) return;
        const pics = G.ladder.map(L => L.pic).concat([G.mainFar, G.main]);
        for (const p of pics) {
            if (!p || !p.done) continue;
            for (const c of [p.lit, p.dark]) if (c && !warmed.has(c)) { warmed.add(c); ctx.drawImage(c, 0, 0, 1, 1); ctx.fillStyle = P.INK; ctx.fillRect(0, 0, 1, 1); return; }   // GAME: no tower over that pixel: inked again
        }
    }
    const tickFrom = () => { if (tOn) tLast = performance.now(); };         // (the split) LandFall.js's frame starts the test timing from here
    // (the split) for LandFallFlight.js and LandFall.js
    Object.assign(Z, {
        setCtx: c => { ctx = c; },
        revNoise, bakeVeil, off, revRows, warmRelease, drawOrbit, warmPics, drawRelease, renderScene, tick, warmSeen, tickFrom
    });
})();
