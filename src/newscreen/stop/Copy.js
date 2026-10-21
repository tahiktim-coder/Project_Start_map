/* ═══ Silent Exodus · new screen (?new=1) · stop/Copy.js: the fall through the gap, and the copy of Earth ═══════════════
   What it is: the bad side of "Fly the ship through the gap" (data/AnomalyEncounters.js ANOMALY_FOLD), on the bridge.
   THE FALL (no input; a click hurries it; about 8 s). The card closes with no outcome step (bundle.js handleAnomalyTeleport):
     the glass splits the world we were at into two, side by side, a thin seam between them where the stars do not line up;
     we push into the seam (the two slide away, the stars smear into streaks); the lamps flicker and die, the room drops to
     its screens' glow; the crew brace (CrewEngine 'brace'); a hard jolt (none under reduced motion); black for 1.2 s; then
     the light comes back slow and blue, Earth's own light through the glass, and Earth brakes into the window, turning.
   THE COPY: Earth turns a few seconds, clouds drifting, then stops dead, clouds and all (reduced motion: it never turns).
     The stars behind it stand in perfect rows. The crew react one line at a time beside the speaker (stop/CopyWords.js);
     whoever the fall threw against the wall lies on the floor with Aris kneeling by them (unless a breakdown has taken them
     off the bridge), and over everyone the fall shook their state shows a moment (name, "+1 stress" / "hurt"). A line said
     then goes above the speaker's mark (stop/Stop.js anchors). Then Scan, "Fight to escape" and "Go down" (NSOrbit.actions).
     Scan: under the glass's sweep the skin shows what it is, a bare grey lattice with nothing inside, healing behind it.
     Fight to escape: held on Cora's console (3 s); the engines strain, the picture shakes, Earth slides off-centre; let go
     and it drifts back. Won: we swing away and see it side on: a flat painted disc, its back unfinished grey struts; the
     seam opens and throws us out (bundle.js escapeWrongPlace), the travel view opens on that sector, A.U.R.A. says what it
     cost. Go down: the cool held key; the crew's say first (askGoingDown), then the trap's ending (bundle.js endOnTheCopy).
   Saved on the copy's node: _nsCopy { seen, scanned, council }. A reload comes back to it with Earth still, the same keys.
   Draws through Stop.js's hooks (attach). Loaded only with the new-screen switch, after stop/Words.js, before stop/Stop.js.

   window.NSCopy (frozen)
     attach(ctx)               Stop.js: { S, poseOf, glassAt(c, t) (the glass as Glass draws it), sweep() → ms | null }
     fall(app) → bool          the bad roll's state is set: play the fall (false: not on the bridge; the caller opens it)
     view(t) → v | null        this frame: { black, fall (glass: the fall's), dark 0..1, light 0..1, fadeJ, shake [dx, dy],
                               noWords, noActs }
     drawFallGlass(c, t)  drawRoom(c, t, v)  glass(c, t, o)   the pictures (o: { g } from Glass.geom)
     desired(crew, t) → { id: { x, act, facing } | null } | null   where everyone is on the bridge now (null: Stop's own)
     shownAtFor(id, t) → ms | null   the copy opening during the fall: Earth brakes in from the return
     update(dt, t)             the clock: the fall, the talk, the stop, the fight, the reveal
     hurry()                   a click during the fall; falling() → bool
     ready(node) → bool        the keys may show (Earth has stopped, or we came back to it)
     fightK(), holdFight(on), fighting(), revealing(), talking()
     marks(t) → [{ id, text, lying }]   the state over each person, a moment after the fall
     scan(app)                 the bridge's scan, done: A.U.R.A.'s line
     escape(app)               the fight won: the reveal, then out
     askGoingDown(app)         "Go down" held: the crew's say ("Not yet" first), then the ending
     fightChips(app) → chips   what the fight costs now (Orbit.js shows them under its key)
     used(key) → bool          'escape' / 'accept' already pressed here (stop/Words.js: A.U.R.A. does not explain it then)
     debug() → {...}
*/
(function () {
    'use strict';
    const NS = window.NewScreen, P = window.NSPaint, GL = window.NSGlass, BA = window.NSBridgeArt, E = window.NSEarthArt, WD = window.NSCopyWords, CE = window.CrewEngine;
    if (!NS || !NS.on || !P || !GL || !BA || !E || !WD || !CE) return;
    const { INK, threshold, smooth, clamp01, hash, RP } = P;
    const WIN = GL.WIN, SW = GL.SW, SH = GL.SH, OFFX = GL.OFFX, F = BA.B.F;
    const GW = WIN.x1 - WIN.x0, GH = WIN.y1 - WIN.y0, SEAM = Math.round((WIN.x0 + WIN.x1) / 2);
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const still = () => !!(mq && mq.matches);
    const ease = k => k * k * (3 - 2 * k);
    const STEP = 125;

    // ── the fall, in ms since it began ──
    const T = Object.freeze({ SPLIT: 1000, PUSH: 1700, PUSH_END: 3300, DIE: 2000, DARK: 2600, BRACE: 2350, JOLT: 3050, JOLT_MS: 420, BLACK: 3400, OPEN: 3700, RETURN: 4600 });
    // ── after the return (R): the slow blue light, the lamps, the talk, the stop ──
    const R_ = Object.freeze({ FADE: 1800, LAMPS: 2600, LAMPS_MS: 450, HURT: 1300, HOME: 4900, HOME_ALONE: 2600, STOP: 8300, STOP_ALONE: 6000, AFTER_STOP: 1200, GAP: 300, MARKS_FROM: 1100, MARKS_MS: 7900 });
    const SPIN = 34, CLOUD_LAG = 7;                                           // degrees Earth turns (and the clouds lag) before it stops
    const FIGHT_MS = 3000, FIGHT_BACK_MS = 900, SLIDE = { x: -96, y: 9, shrink: 0.2 };
    const REVEAL = Object.freeze({ TURN: 1400, EDGE: 500, BACK: 1500, HOLD: 800, SWING: 4200, SEAM: 1400, INK: 600 });   // SWING = TURN + EDGE + BACK + HOLD
    const HEAL_MS = 650, REACT_LATEST_MS = 15000;
    // where people are at the copy (room x, as Stop.js plans them): whoever was thrown lies there, the others at the window
    const HELM = 360, NAV = 488, LIE_X = 178, SPOTS = [228, 262, 296, 330], SPOTS_BY_HURT = [250, 286, 322, 214];
    const CREW = ['jaxon', 'aris', 'vance', 'mira'];
    const ROLE = { cora: 'LEADER', jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
    const NAME = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira', aura: 'A.U.R.A.' };

    let ctx = null;
    const C = { fall: null, ret: null, talk: null, stopAt: null, stopped: false, fight: { k: 0, held: false, said: false, won: false }, reveal: null, heal: null, lastSweep: null, nodeId: null, shownAt: -1e9, marksFrom: null };

    const app = () => NS.app || window.app || null;
    const state = () => { const a = app(); return (a && a.state) || null; };
    const here = () => { const s = state(); return s && s.currentSystem && s.currentSystem._isWrongPlace ? s.currentSystem : null; };
    const member = id => { const s = state(); return ((s && s.crew) || []).find(c => (c.tags || []).includes(ROLE[id])) || null; };
    const idOfName = name => Object.keys(ROLE).find(id => { const m = member(id); return m && m.name === name; }) || null;
    const voice = () => (NS.mods && NS.mods.voice) || null;
    const flags = n => { if (!n._nsCopy || typeof n._nsCopy !== 'object') n._nsCopy = {}; return n._nsCopy; };
    function save() { const a = app(); if (a && typeof a.autoSave === 'function') { try { a.autoSave(); } catch (err) { console.error('NSCopy: the save failed', err); } } }
    /** Nothing said from before the fall carries on through it (lines that waited behind the card). */
    function hush() { const v = voice(); if (v && typeof v.hush === "function") { try { v.hush(); } catch (err) { console.error("NSCopy: the hush failed", err); } } }
    function say(id, text, log) {
        const v = voice(), s = state();
        let p = Promise.resolve(false);
        if (v && typeof v.say === 'function') { try { p = v.say({ id, who: NAME[id] || id, text }); } catch (err) { console.error('NSCopy: the voice failed', err); } }
        if (log !== false && s) s.addLog(`${NAME[id] || id}: "${text}"`);                       // the log keeps it (the voice skips the line it is saying)
        return p;
    }

    // ════════════════════════════════════════ 1. the fall ════════════════════════════════════════
    /** The bad roll has set the state (we are at the copy): the fall plays on the bridge. false: not on the bridge now. */
    function fall(a) {
        const s = a && a.state, n = s && s.currentSystem, st = NS.mods.stop;
        if (!n || !n._isWrongPlace || !ctx || !NS.isShown() || NS.mode() !== 'stop' || !st || !st.isOpen()) return false;
        const t = NS.clock.t;
        C.fall = { t0: t, opened: false, snapshot: snapshot(t), victim: idOfName(n._thrown), node: n.id };
        C.ret = null; C.talk = null; C.stopAt = null; C.stopped = false; C.reveal = null; C.fight = { k: 0, held: false, said: false, won: false };
        flags(n).seen = true;                                                                  // saved now: a reload comes back to the copy, never before the gap
        hush();
        save();
        return true;
    }
    const falling = () => !!(C.fall && !C.ret);
    /** Who stands where on the bridge as the fall begins (they brace there). */
    function snapshot(t) {
        const out = [];
        ['cora'].concat(CREW).forEach(id => { const p = ctx.poseOf(id, t); if (p && !p.hidden) out.push({ id, x: Math.round(p.x), facing: p.facing || 1, act: p.act === 'console' ? 'console' : 'idle' }); });
        return out;
    }
    /** A click during the fall: into the black at once (the copy opens under it); another, the light comes back. */
    function hurry() {
        if (!C.fall || C.ret) return;
        const el = NS.clock.t - C.fall.t0;
        if (el < T.OPEN) C.fall.t0 -= T.OPEN - el;
        else if (el < T.RETURN - 150) C.fall.t0 -= T.RETURN - 150 - el;
    }
    /** The fall's glass: the world split in two along a seam, then the seam opening into streaks. */
    const STREAKS = Array.from({ length: 70 }, (_, i) => ({ a: hash(i, 3, 91) * Math.PI * 2, d: 0.08 + 0.92 * hash(i, 5, 91), v: hash(i, 7, 91) }));
    const EDGE_FADE = 26;
    /** ex: the first column past (dir -1) or before (dir 1) a slid half's picture; the columns on its side, inside [lo, hi), fall off to ink. */
    function fadeEdge(f, ex, dir, lo, hi) {
        for (let i = 0; i < EDGE_FADE; i++) {
            const x = dir < 0 ? ex - 1 - i : ex + i, k = 1 - i / EDGE_FADE;
            if (x < lo || x >= hi) continue;
            for (let y = WIN.y0; y < WIN.y1; y++) if (k > threshold(x, y)) f.px(x, y, INK);
        }
    }
    function drawFallGlass(c, t) {
        const el = t - C.fall.t0, calm = still(), step = k => (calm ? k : Math.floor(k * 8) / 8);
        const split = step(ease(clamp01(el / T.SPLIT))), push = clamp01((el - T.PUSH) / (T.PUSH_END - T.PUSH)), pu = step(push * push);
        const shL = Math.round(150 * split + 330 * pu), shR = Math.round(48 * split + 330 * pu), gap = Math.round(1 + 170 * pu * pu);
        c.save(); c.beginPath(); c.rect(WIN.x0, WIN.y0, GW, GH); c.clip();
        c.fillStyle = INK; c.fillRect(WIN.x0, WIN.y0, GW, GH);
        [[WIN.x0, SEAM - (gap >> 1), -shL], [SEAM + (gap >> 1) + 1, WIN.x1, shR]].forEach(([x0, x1, dx]) => {
            if (x1 <= x0) return;
            c.save(); c.beginPath(); c.rect(x0, WIN.y0, x1 - x0, GH); c.clip(); c.translate(dx, 0);
            try { ctx.glassAt(c, t); } catch (err) { console.error('NSCopy: the glass failed', err); }
            c.restore();
        });
        const f = P.framer(c, SW, SH), cy = Math.round((WIN.y0 + WIN.y1) / 2);
        fadeEdge(f, WIN.x1 - shL, -1, WIN.x0, SEAM - (gap >> 1));                        // where a half's picture runs out: a dithered fall-off
        fadeEdge(f, WIN.x0 + shR, 1, SEAM + (gap >> 1) + 1, WIN.x1);                    // to black, never a cut down the pane
        const glowK = split * (1 - pu) * (0.55 + 0.45 * (Math.floor(el / STEP) % 4 < 2 ? 1 : 0.6));   // the seam: a cold thread of light, breathing
        for (let y = WIN.y0; y < WIN.y1; y++) {
            const wob = Math.round(Math.sin(y / 9 + el / 400) * (calm ? 0 : 0.6));
            const e0 = SEAM - (gap >> 1) - 1 + wob, e1 = SEAM + (gap >> 1) + 1 + wob;
            f.tone(e0, y, RP.UI, 0.45 + 0.4 * glowK + 0.35 * pu); if (gap > 2) f.tone(e1, y, RP.UI, 0.45 + 0.35 * pu);
            if (glowK > 0.05) { f.tone(e0 - 1, y, RP.UI, 0.25 * glowK); f.tone(e1 + 1, y, RP.UI, 0.25 * glowK); }
        }
        if (push > 0) {                                                                    // the stars smear into streaks, out of the seam
            const len = 4 + 90 * pu, span = Math.hypot(GW, GH) * 0.6;
            STREAKS.forEach(s => {
                const r0 = s.d * span, r1 = r0 + len * (0.4 + 0.6 * s.v), ca = Math.cos(s.a), sa = Math.sin(s.a) * 0.62;
                const n = Math.ceil(r1 - r0);
                for (let k = 0; k <= n; k++) { const rr = r0 + k, x = SEAM + ca * rr, y = cy + sa * rr; if (x < WIN.x0 || x >= WIN.x1 || y < WIN.y0 || y >= WIN.y1) continue; f.tone(x, y, RP.STAR, (0.3 + 0.55 * s.v) * (1 - k / (n + 1) * 0.7) * (0.5 + 0.5 * pu)); }
            });
        }
        c.restore();
    }

    // ════════════════════════════════════════ 2. the room: lamps out, Earth's blue light ════════════════════════════════════════
    const inGlass = (x, y) => x >= WIN.x0 - 1 && x <= WIN.x1 && y >= WIN.y0 - 1 && y <= WIN.y1;
    const HUNG = [[236 + OFFX, 46], [486 + OFFX, 40]];                        // BridgeArt's two lamps hung in front of the window (bulb row, frame px)
    const inCage = (x, y) => HUNG.some(([lx, ly]) => Math.abs(x - lx) <= 5 && y >= ly - 4 && y <= ly + 3);
    function darkAlpha(x, y) {
        if (inCage(x, y)) return 0.9;                                             // the hung lamps go out with the rest
        if (inGlass(x, y)) return 0;
        const scr = (x0, y0, w, h, reach) => { const dx = Math.max(x0 - x, 0, x - x0 - w), dy = Math.max(y0 - y, 0, y - y0 - h); return Math.exp(-Math.hypot(dx, dy * 1.3) / reach); };
        const glow = 0.95 * scr(400 + OFFX, 245, 9, 16, 16) + 0.95 * scr(526 + OFFX, 239, 14, 22, 20)
            + (x > WIN.x0 && x < WIN.x1 ? 0.32 * Math.exp(-Math.abs(y - (WIN.y1 + 9)) / 4) : 0) + 0.3 * scr(616 + OFFX, 112, 16, 20, 8);
        return 0.9 * (1 - Math.min(1, glow));
    }
    function lightAlpha(x, y) {
        if (inGlass(x, y)) return 0;
        const dx = Math.max(WIN.x0 - x, 0, x - WIN.x1), dy = Math.max(WIN.y0 - y, 0, y - WIN.y1);
        return 0.62 * Math.exp(-Math.hypot(dx * 1.1, dy) / 64) * (y > WIN.y1 ? 1 : 0.7);
    }
    const INK_RGB = P.hexRgb(INK);
    const TINT = Object.freeze({ seam: [34, 46, 66], earth: [14, 40, 96] });    // the seam's cold light in the fall; Earth's blue after it
    let roomA = null, roomL = null;
    /** Over the frame's pixels as drawn: the lamps out (toward the ink, the screens and the sill's lights kept), then the light
        through the glass added (a colour, in four dithered steps), and over everything a dim toward black (the light coming
        back). Colours darken smoothly, in the house's dithered steps: never a screen door of ink pixels. */
    function drawRoom(c, t, v) {
        const dim = v.dim || 0, dk = v.dark || 0, lt = v.light || 0;
        if (dim < 0.01 && dk < 0.01 && lt < 0.01) return;
        if (!roomA) {
            roomA = new Float32Array(SW * SH); roomL = new Float32Array(SW * SH);
            for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { roomA[y * SW + x] = darkAlpha(x, y); roomL[y * SW + x] = lightAlpha(x, y); }
        }
        const img = c.getImageData(0, 0, SW, SH), d = img.data, tint = v.tint || TINT.earth, ink = INK_RGB;
        for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
            const i = y * SW + x, o = i * 4, th = threshold(x, y);
            let r = d[o], g = d[o + 1], b = d[o + 2];
            const a = roomA[i] * dk;
            if (a > 0.01) { const q = Math.min(1, Math.floor(a * 6 + th) / 6); r += (ink[0] - r) * q; g += (ink[1] - g) * q; b += (ink[2] - b) * q; }
            const l = roomL[i] * lt;
            if (l > 0.02) { const q = Math.floor(l * 4 + th) / 4; r += tint[0] * q; g += tint[1] * q; b += tint[2] * q; }
            if (dim > 0.01) { const q = Math.min(1, Math.floor(dim * 8 + th) / 8); r += (ink[0] - r) * q; g += (ink[1] - g) * q; b += (ink[2] - b) * q; }
            d[o] = r; d[o + 1] = g; d[o + 2] = b;
        }
        c.putImageData(img, 0, 0);
    }

    // ════════════════════════════════════════ 3. the copy in the glass ════════════════════════════════════════
    let sky = null;
    const pics = new Map();
    const L = P.norm3(0.42, -0.36, 0.83);                                          // the glass's own light (Glass.js LW)
    /** How Earth turns now: [longitude facing us, how far the clouds lag], stepped (125 ms); still once it has stopped. */
    function turnAt(t) {
        if (still() || C.stopped || !C.ret || C.stopAt == null) return [E.VIEW.lon, 0];
        const left = Math.max(0, Math.floor((C.stopAt - t) / STEP) * STEP);
        const rate = SPIN / (C.stopAt - C.ret.R);
        return [E.VIEW.lon + left * rate, -CLOUD_LAG * left / (C.stopAt - C.ret.R)];
    }
    /** The lattice under the scan's sweep (TagArt's sweep: an arc across the face in 14 steps), healing behind it. */
    function latticeAt(t) {
        const sw = ctx && ctx.sweep ? ctx.sweep() : null;
        let th = null, fade = 1;
        if (sw != null) { const u = still() ? 0.62 : (Math.floor(sw / STEP) % 14) / 13; th = (clamp01(u) * 2 - 1) * Math.PI / 2 * 0.94; }
        else if (C.heal && t - C.heal.t0 < HEAL_MS) { th = C.heal.th; fade = 1 - (t - C.heal.t0) / HEAL_MS; }
        if (th == null) return null;
        const q = Math.round(fade * 6) / 6;
        return { key: th.toFixed(2) + ':' + q, fn: (nx, ny, nz) => { const d = th - Math.atan2(nx, nz); return (d < -0.07 ? 0 : d < 0.3 ? 1 : Math.max(0, 1 - (d - 0.3) / 0.6)) * q; } };
    }
    function earthPic(r, lon, clouds, lat) {
        const key = [r, lon.toFixed(2), clouds.toFixed(2), lat ? lat.key : ''].join('|');
        if (pics.has(key)) return pics.get(key);
        const half = Math.ceil(r + Math.max(1.6, r / 30) + 2), p = P.painter(half * 2, half * 2, false);
        E.paint(p, { cx: half, cy: half, r, L, lon, clouds, lattice: lat ? lat.fn : null });
        const out = { canvas: p.canvas(), half };
        if (pics.size > 40) pics.clear();
        pics.set(key, out);
        return out;
    }
    /** Where Earth sits now: Glass's arrival (o.g), pulled off-centre while the fight is held. */
    function earthGeom(t, g) {
        const k = still() ? C.fight.k : Math.floor(C.fight.k * 16) / 16, e = ease(k);
        return { x: Math.round(g.x + SLIDE.x * e), y: Math.round(g.y + SLIDE.y * e), r: Math.max(4, Math.round(g.r * (1 - SLIDE.shrink * e))) };
    }
    /** The glass at the copy (Glass.draw calls it for the Wrong Place): the sky in rows, Earth. */
    function glass(c, t, o) {
        if (!sky) sky = E.sky(GW, GH, {});
        c.drawImage(sky, WIN.x0, WIN.y0);
        if (!E.prepare(60)) return;                                                     // the maps are still being made (a fraction of a second)
        if (C.reveal) { drawReveal(c, t, o.g); return; }
        const eg = earthGeom(t, o.g), [lon, clouds] = turnAt(t), lat = latticeAt(t);
        const pic = earthPic(eg.r, lon, clouds, lat);
        c.drawImage(pic.canvas, eg.x - pic.half, eg.y - pic.half);
    }
    /** The fight won: we swing away and see it side on. It turns edge-on, a flat painted disc a few pixels thick; turns on,
        and its back is bare struts, unfinished. It slides off as the seam opens and takes us. */
    function revealAt(el) {
        const R = REVEAL, deg = Math.PI / 180;
        if (el < R.TURN) return { phi: ease(el / R.TURN) * 90 * deg, dx: 64 * ease(el / R.TURN) };   // back toward the middle of the glass as it turns
        if (el < R.TURN + R.EDGE) return { phi: 90 * deg, dx: 64 };
        if (el < R.SWING) { const k = clamp01((el - R.TURN - R.EDGE) / R.BACK); return { phi: (90 + 55 * ease(k)) * deg, dx: 64 - 14 * k }; }
        const k = clamp01((el - R.SWING) / R.SEAM);
        return { phi: 145 * deg, dx: 50 - 300 * k * k };
    }
    function drawReveal(c, t, g) {
        const el = t - C.reveal.t0, calm = still(), stepEl = calm ? el : Math.floor(el / STEP) * STEP;
        const { phi, dx } = revealAt(stepEl), x0 = g.x + SLIDE.x, y0 = g.y + SLIDE.y, r = Math.max(4, Math.round(g.r * (1 - SLIDE.shrink)));
        const cx = Math.round(x0 + dx), cy = Math.round(y0), cos = Math.cos(phi), sin = Math.abs(Math.sin(phi));
        const front = earthPic(r, E.VIEW.lon, 0, null);
        const back = C.reveal.back || (C.reveal.back = (() => { const half = r + 3, p = P.painter(half * 2, half * 2, false); E.back(p, { cx: half, cy: half, r, L }); return { canvas: p.canvas(), half, r }; })());
        const pic = cos >= 0 ? front : back, hw = (pic.half - (pic === front ? 0 : 3)) * Math.abs(cos), w = Math.max(0, Math.round(hw * 2));
        if (w >= 2) c.drawImage(pic.canvas, 0, 0, pic.half * 2, pic.half * 2, cx - Math.round(pic.half * Math.abs(cos)), cy - pic.half, Math.round(pic.half * 2 * Math.abs(cos)), pic.half * 2);
        const f = P.framer(c, SW, SH), th = Math.max(2, Math.round(1 + 4 * sin)), side = cos >= 0 ? 1 : -1;   // the disc's edge: a few pixels of grey, hugging its outline
        for (let y = -r; y <= r; y++) {
            const hh = Math.sqrt(Math.max(0, 1 - (y / r) ** 2));
            if (hh < 0.04) continue;
            const ex = cx + side * Math.round(r * Math.abs(cos) * hh);
            for (let i = 0; i < th; i++) f.tone(ex + side * i, cy + y, E.RAMPS.LATTICE, 0.3 + 0.28 * hh + (i === 0 ? 0.12 : 0) + (side > 0 ? 0.08 : 0));
        }
        const s = clamp01((el - REVEAL.SWING) / REVEAL.SEAM);                            // the seam opens and takes us
        if (s <= 0) return;
        const gap = Math.round(2 + GW * (calm ? s : Math.floor(s * 8) / 8) * 0.8);
        c.fillStyle = INK; c.fillRect(SEAM - (gap >> 1), WIN.y0, gap, GH);
        for (let y = WIN.y0; y < WIN.y1; y++) { f.tone(SEAM - (gap >> 1) - 1, y, RP.UI, 0.8); f.tone(SEAM + (gap >> 1) + 1, y, RP.UI, 0.8); }
        STREAKS.forEach(st => {
            const len = 8 + 80 * s, r0 = st.d * gap * 0.6, ca = Math.cos(st.a), sa = Math.sin(st.a) * 0.62;
            for (let q = 0; q < len; q++) { const x = SEAM + ca * (r0 + q), y = (WIN.y0 + WIN.y1) / 2 + sa * (r0 + q); if (Math.abs(x - SEAM) < gap / 2 && y >= WIN.y0 && y < WIN.y1) f.tone(x, y, RP.STAR, (0.35 + 0.5 * st.v) * (1 - q / len)); }
        });
    }

    // ════════════════════════════════════════ 4. people ════════════════════════════════════════
    const BRACE = CE.ACTIONS.brace ? 'brace' : 'wall';
    let tendDX = null;
    /** Where everyone should be on the bridge (room x, as Stop.js plans them), or null: Stop's own rules. */
    function desired(crew, t) {
        if (C.fall && !C.fall.opened) {                                                  // the fall: everyone braces where they stood
            const out = {}, el = t - C.fall.t0;
            C.fall.snapshot.forEach(p => { out[p.id] = { x: p.x, act: el >= T.BRACE ? BRACE : p.act, facing: p.facing }; });
            return out;
        }
        const n = here();
        if (!n) return null;
        const victim = idOfName(n._thrown), down = victim && crew[victim] === 'hurt' ? victim : null;   // only if they are here: a breakdown may have shut them away
        const out = { cora: crew.cora === 'dead' ? null : { x: HELM, act: 'console', facing: 1 } };
        if (down) out[down] = { x: LIE_X, act: 'sleep', facing: -1 };
        const tends = down && down !== 'aris' && crew.aris === 'well';
        if (tends) { if (tendDX == null) tendDX = 42 - CE.sprite('aris', 'tend', 0).hands[1].x; out.aris = { x: LIE_X + tendDX, act: 'tend', facing: 1 }; }
        const spots = (down ? SPOTS_BY_HURT : SPOTS).slice();
        CREW.forEach(id => { if (id in out) return; out[id] = crew[id] === 'well' ? { x: spots.shift(), act: 'idle', facing: 1 } : null; });
        if (C.reveal && t - C.reveal.t0 >= REVEAL.SWING) Object.keys(out).forEach(id => { const o = out[id]; if (o && (o.act === 'idle' || o.act === 'console')) out[id] = Object.assign({}, o, { act: BRACE }); });   // the seam takes us: they brace
        return out;
    }
    /** The state over each person a moment after the fall (and on coming back to it): who is hurt, who the fall shook. */
    function marks(t) {
        const n = here();
        if (!n || C.marksFrom == null || t < C.marksFrom || t > C.marksFrom + R_.MARKS_MS || C.reveal) return null;
        const before = n._stressBefore || {}, victim = idOfName(n._thrown), out = [];
        ['cora'].concat(CREW).forEach(id => {
            const m = member(id), p = ctx && ctx.poseOf ? ctx.poseOf(id, t) : null;
            if (!m || m.status === 'DEAD' || !p || p.hidden) return;                    // only over someone on the bridge
            if (id === victim && m.status !== 'HEALTHY') { out.push({ id, text: 'hurt', lying: true }); return; }
            const d = (m.stress || 0) - (before[m.name] || 0);
            if (d > 0) out.push({ id, text: `+${d} stress` });
        });
        return out.length ? out : null;
    }

    // ════════════════════════════════════════ 5. the clock ════════════════════════════════════════
    /** The copy opened during the fall: Earth brakes in from the return. */
    function shownAtFor(id, t) {
        if (!C.fall || C.fall.node !== id) return null;
        return C.fall.t0 + T.RETURN + 600;                                              // Stop.js: arrival 0 at shownAt - 600 (the dissolve)
    }
    function view(t) {
        const n = here();
        if (C.fall && !C.ret) {
            const el = t - C.fall.t0;
            if (el >= T.BLACK) return { black: true };
            const flick = el >= T.DIE && el < T.DARK ? ([1, 0, 1, 1, 0, 0, 1, 0][Math.floor((el - T.DIE) / 75) % 8] ? 1 : 0.12) : el >= T.DARK ? 1 : 0;
            const j = el >= T.JOLT && el < T.JOLT + T.JOLT_MS && !still() ? 1 - (el - T.JOLT) / T.JOLT_MS : 0;
            const sh = j > 0 ? [Math.round((hash(Math.floor(el / 40) & 255, 1, 7) - 0.5) * 9 * j), Math.round((hash(Math.floor(el / 40) & 255, 2, 7) - 0.5) * 6 * j)] : [0, 0];
            const seam = clamp01((el - T.PUSH) / (T.PUSH_END - T.PUSH));                     // the seam's light floods in as it opens
            return { fall: true, dark: flick, light: flick > 0.5 ? 0.35 + 0.65 * seam : 0, tint: TINT.seam, shake: sh, noWords: true, noActs: true };
        }
        if (!n) return null;
        if (C.reveal) {                                                                    // the reveal; then the seam throws us out: a hard jolt, black
            const el = t - C.reveal.t0, end = REVEAL.SWING + REVEAL.SEAM;
            if (el >= end) return { black: true };
            const j = el >= end - 450 && !still() ? 1 - (end - el) / 450 : 0, tick = Math.floor(el / 40) & 255;
            const sh = j > 0 ? [Math.round((hash(tick, 5, 7) - 0.5) * 10 * j), Math.round((hash(tick, 6, 7) - 0.5) * 7 * j)] : [0, 0];
            return { dark: 0, light: el > REVEAL.SWING ? 0.7 * clamp01((el - REVEAL.SWING) / REVEAL.SEAM) : 0, tint: TINT.seam, shake: sh, noWords: true, noActs: true };
        }
        const v = { dark: 0, light: 0, dim: 0, tint: TINT.earth, shake: [0, 0], noWords: false, noActs: false };
        if (C.ret) {                                                                       // the light comes back slow and blue: Earth's own, through the glass
            const el = t - C.ret.R;
            if (el < 0) return { black: true };
            if (el < R_.FADE) v.dim = 1 - el / R_.FADE;
            const back = R_.LAMPS + R_.LAMPS_MS;                                            // the lamps flicker back on
            if (el < R_.LAMPS) v.dark = 1;
            else if (el < back) v.dark = [1, 0, 1, 0, 0, 1, 0, 0][Math.floor((el - R_.LAMPS) / 60) % 8] ? 0.85 : 0;
            v.light = el < back ? 1 : Math.max(0, 1 - (el - back) / 1400);
        }
        if (C.fight.held && !still()) {
            const k = 1 + 2.4 * C.fight.k, tick = Math.floor(t / 45);
            v.shake = [Math.round((hash(tick & 255, 3, 11) - 0.5) * k), Math.round((hash(tick & 255, 4, 11) - 0.5) * k * 0.7)];
        }
        if (C.fight.held || C.fight.k > 0.02) v.noActs = true;                          // the strain: only the keys stay
        return v;
    }
    function update(dt, t) {
        if (C.fall || here()) E.prepare(24);
        if (C.fall && !C.fall.opened && t - C.fall.t0 >= T.OPEN) {                      // under the black: the game opens the copy (no dive)
            C.fall.opened = true;
            const a = app();
            try { a.state.emitUpdates(); a.renderOrbit(); } catch (err) { console.error('NSCopy: opening the copy failed', err); }
            hush();
        }
        if (C.fall && !C.ret && t - C.fall.t0 >= T.RETURN) begin(C.fall.t0 + T.RETURN, C.fall.victim);
        const n = here();
        if (!n) { if (!C.fall) reset(); return; }
        if (!falling() && C.nodeId !== n.id) arrive(n, t);
        if (C.ret && !C.stopped && C.stopAt != null && t >= C.stopAt) { C.stopped = true; }
        tickTalk(t);
        tickFight(dt, t);
        const sw = ctx && ctx.sweep ? ctx.sweep() : null;                               // the scan's sweep over: its lattice heals
        if (sw == null && C.lastSweep != null) C.heal = { t0: t, th: (1 * 2 - 1) * Math.PI / 2 * 0.94 };
        C.lastSweep = sw;
        if (C.reveal && !C.reveal.done && t - C.reveal.t0 >= REVEAL.SWING + REVEAL.SEAM + REVEAL.INK) out();
    }
    /** We are at the copy (the fall's return, or the bridge opened on it after a reload). */
    function arrive(n, t) {
        C.nodeId = n.id;
        if (!C.ret) { C.stopped = true; C.marksFrom = t + 600; }                          // came back to it: still, the keys at once
    }
    function begin(R, victim) {
        C.ret = { R, victim };
        C.nodeId = C.fall ? C.fall.node : C.nodeId;
        const s = state(), alone = !WD.arrival(s, victim).some(l => l.key === 'hurt');
        C.stopAt = R + (alone ? R_.STOP_ALONE : R_.STOP);
        C.stopped = still() ? true : false;
        C.marksFrom = R + R_.MARKS_FROM;
        const lines = WD.arrival(s, victim).map(l => Object.assign({}, l));
        let at = R + R_.HURT;
        lines.forEach(l => {                                                             // fixed slots until the stop; after it, one after another
            if (l.key === 'hurt') { l.at = at; return; }
            if (l.key === 'home') { l.at = R + (alone ? R_.HOME_ALONE : R_.HOME); return; }
        });
        C.talk = { lines, i: 0, busy: false, next: 0 };
    }
    function tickTalk(t) {
        const k = C.talk;
        if (!k || k.i >= k.lines.length || NS.blocked() || NS.mode() !== 'stop') return;
        const l = k.lines[k.i];
        if (l.afterStop && !C.stopped) return;
        const due = l.at != null ? t >= l.at : !k.busy && t >= k.next && (!l.afterStop || t >= C.stopAt + R_.AFTER_STOP);
        if (!due) return;
        k.i++; k.busy = true;
        say(l.who, l.text).then(() => { if (C.talk === k) { k.busy = false; k.next = NS.clock.t + R_.GAP; } });
    }
    const talking = () => !!(C.talk && C.talk.i < C.talk.lines.length) || !!(C.ret && !C.stopped);
    function ready(n) { return !!n && (C.nodeId !== n.id || C.stopped) && !falling(); }
    function reset() { C.fall = null; C.ret = null; C.talk = null; C.stopAt = null; C.stopped = false; C.reveal = null; C.nodeId = null; C.marksFrom = null; C.fight = { k: 0, held: false, said: false, won: false }; }

    // ── the fight: held on Cora's console ──
    function holdFight(on) { if (!here() || C.reveal) { C.fight.held = false; return; } C.fight.held = !!on; }
    function tickFight(dt, t) {
        const f = C.fight;
        if (f.won || C.reveal) return;
        if (f.held && (NS.blocked() || NS.mode() !== 'stop')) f.held = false;
        f.k = f.held ? Math.min(1, f.k + dt / FIGHT_MS) : Math.max(0, f.k - dt / FIGHT_BACK_MS);
        if (f.held && f.k > 0.12 && !f.said) { f.said = true; const who = WD.first(state(), WD.FIGHT.by); if (who) say(who, WD.FIGHT.text); }
        if (f.k >= 1) { f.won = true; f.held = false; try { NS.flow.act('escape'); } catch (err) { console.error('NSCopy: the escape failed', err); f.won = false; } }
    }
    /** The fight won (NSOrbit's 'escape'): the reveal, then the seam takes us out. */
    function escape(a) {
        if (!here() || C.reveal) return false;
        C.reveal = { t0: NS.clock.t, done: false };
        C.fight.won = true; C.fight.held = false;
        const v = voice(); if (v && v.hush) v.hush();
        return true;
    }
    function out() {
        C.reveal.done = true;
        const a = app(), s = state();
        const failed = err => { console.error('NSCopy: leaving the copy failed', err); C.reveal = null; C.fight = { k: 0, held: false, said: false, won: false }; };   // back at the window to try again: never stuck on black
        if (!a || !s || typeof a.escapeWrongPlace !== 'function') { failed(new Error('the game cannot leave the copy')); return; }
        let lost = null;
        try { lost = a.escapeWrongPlace(s); } catch (err) { failed(err); return; }
        reset();
        window.dispatchEvent(new Event('hud-updated'));                               // the numbers at once; how the crew take it after A.U.R.A. has said what it cost
        save();
        const line = WD.escaped(lost);
        let reacted = false;
        const react = () => { if (reacted) return; reacted = true; try { s.emitUpdates(); save(); } catch (err) { console.error('NSCopy: the crew update failed', err); } };
        NS.bus.once('opening:done', () => setTimeout(() => { say('aura', line).then(react, react); }, 600));   // once the new sector has opened: what it cost
        setTimeout(react, REACT_LATEST_MS);                                               // never later than this, whatever the opening does
        a.renderNav();
    }

    // ── the scan, the council ──
    function scan(a) {
        const n = here();
        if (!n) return;
        flags(n).scanned = true;
        say('aura', WD.SCAN);
        save();
        if (a && a.state) a.state.emitUpdates();
    }
    function askGoingDown(a) {
        const n = here();
        if (!n || !a || !window.EncounterCard) return;
        const fl = flags(n), cards = WD.council(a.state, !!fl.council);
        fl.council = true;
        window.EncounterCard.open(a, {
            tone: 'station', kicker: cards.kicker, title: cards.title, zIndex: 2800, dialogue: cards.dialogue, choices: cards.choices,
            onPick: idx => { if (idx === 1 && typeof a.endOnTheCopy === 'function') a.endOnTheCopy(); },   // "Not yet": back to the window, nothing spent
        });
    }
    /** A key already pressed here (A.U.R.A. need not explain it any more): the fight once held, Go down once asked. */
    function used(key) { const n = here(); return !!n && (key === 'accept' ? !!(n._nsCopy && n._nsCopy.council) : key === 'escape' ? C.fight.said || C.fight.k > 0 : false); }
    /** What the fight costs now, as chips (bundle.js escapeWrongPlace's own numbers): two rows. */
    function fightChips(a) {
        const s = a && a.state;
        if (!s) return [];
        const e = Math.max(0, Math.round(s.energy - Math.max(10, s.energy - 50))), sv = Math.max(0, Math.round(s.salvage - Math.max(0, s.salvage - 30)));
        const top = [];
        if (e > 0) top.push({ icon: 'energy', text: `-${e} energy`, tone: 'high' });
        if (sv > 0) top.push({ icon: 'salvage', text: `-${sv} salvage`, tone: 'high' });
        return [top, [{ icon: 'risk', text: 'crew +1 stress', tone: 'high' }]].filter(r => r.length);
    }

    function attach(c) { ctx = c; }
    const debug = () => ({ fall: C.fall ? { el: Math.round(NS.clock.t - C.fall.t0), opened: C.fall.opened, victim: C.fall.victim, snapshot: C.fall.snapshot.map(p => p.id) } : null,
        ret: C.ret ? { el: Math.round(NS.clock.t - C.ret.R) } : null, stopAt: C.stopAt, stopped: C.stopped, talk: C.talk ? { i: C.talk.i, of: C.talk.lines.length, busy: C.talk.busy } : null,
        fight: Object.assign({}, C.fight), reveal: C.reveal ? Math.round(NS.clock.t - C.reveal.t0) : null, node: C.nodeId, earth: E.ready() });

    window.NSCopy = Object.freeze({ attach, fall, falling, hurry, view, drawFallGlass, drawRoom, glass, desired, marks, shownAtFor, update, ready, talking,
        fightK: () => C.fight.k, holdFight, fighting: () => C.fight.held || C.fight.k > 0.02, revealing: () => !!C.reveal, scan, escape, askGoingDown, fightChips, used, debug });
})();
