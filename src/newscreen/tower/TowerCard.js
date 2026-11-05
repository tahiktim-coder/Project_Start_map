/* ═══ Silent Exodus · new screen (?new=1) · tower/TowerCard.js: the ship's side of an event card ═══════════════════════
   What it is: look pass B03 (DESIGN.md 1.1 and 1.2, calls C01 and C47). What the tower does for a card:
     crop       one deck of the tower as the frame's picture (cards/FramePictures.js 'deck'): 480 x 160 tower px, TowerArt's own
                room and people and the marks over them, drawn whole (no smoothing) at the art's 8 fps by its caller. The person
                the card is about is posed where it happens and lit; the rest of the deck goes a step dim (a flat step of ink).
                The galley table: everyone alive seated round it, whoever speaks lit. The head count: the five on the bridge,
                its crew screen reading CREW 4 in the 3 x 5 stencil (NSPaint.pixelText).
     the room   while a frame is up (bus card:deck, card:speaker, card:closed) the tower dims every deck but the card's and
                the speaker's, and the one speaking is drawn again over the dim, lit
     the fault  flash(deck, tone): the deck flashes a stepped Bayer wash twice (--wash for a loss, --warm-br for a find); the
                chip beside it is tower/Fault.js's, docked at edge(deck)
   Tower.js hands it the tower's own state (its cardLook: the clock, the people, the marks) and calls draw() after its
   marks. It never writes game state. Loaded only when the new-screen switch is on, after TowerMarks.js, before Tower.js.

   window.NSTowerCard (frozen)
     W, H                         480, 160 (tower px)
     crop(look, deck, ctx, opts) → bool   deck: bridge | lab | quarters | galley | medbay | hold | cargo | engineering;
                                  opts { who: a crew id, crew: 'all' (the five, on the bridge), table: true (the galley
                                  table), screen: words on the bridge's crew screen }; ctx is 480 x 160, its sky drawn
     draw(o, v)                   into the tower's offscreen canvas o; v { t, camY, offX, W, H, people } as Tower.render's
     flash(deck, tone)            'loss' (default) or 'gain'
     edge(deck) → { x, y, inX, inY } | null   CSS px: the outer hull edge level with that deck's middle, and a point inside
                                  it by its floor (where a find is put down); null while the tower is not in view
     room() → { deck, speaker } | null   the card up now (the headless runs)
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const A = window.ShipArt, TW = window.TowerArt, MK = window.NSTowerMarks, P = window.NSPaint;
    if (!A || !TW || !MK || !P) { console.error('TowerCard: the ship art, TowerMarks and NSPaint must load first'); return; }
    const L = A.L, S = A.SPOTS, F = L.DECK_FLOOR;
    const W = 480, H = 160, CROP_Y = 34, X_MIN = 56, X_MAX = L.IR + 16 - W, X_PLAIN = 120;   // the room's middle; its floor at the bottom edge
    const DIM = 0.5, ROOM_DIM = 0.65, STEP_ART = 125, FLASH_STEPS = [0.25, 0.5, 0.25, 0, 0.25, 0.5, 0.25, 0];   // two flashes, 125 ms a step
    const DECK_I = { bridge: 0, lab: 1, quarters: 2, galley: 2, medbay: 3, hold: 4, cargo: 4, engineering: 5 };
    const DECK_NAMES = MK.DECKS;                                           // the tower's own names, by index (its anchors 'tower:deck:<name>')
    const IDS = ['cora', 'jaxon', 'aris', 'vance', 'mira'];
    const HULL_OUT = L.CX + L.HO + 9, PUT_DOWN = { x: 470, y: F - 24 };   // the hold: where a find is put down, by the crates
    // where the person a card is about is, on each deck: [spot, act]
    const WHERE = {
        0: { cora: ['chair', 'sit'], any: ['window', 'idle'] }, 1: { any: ['bench', 'console'] }, 2: { any: ['seatL1', 'sit'] },
        3: { aris: ['medTerminal', 'console'], any: ['medCabinet', 'idle'] }, 4: { any: ['holdSeat', 'sit'] }, 5: { jaxon: ['engDesk', 'console'], any: ['gauges', 'idle'] },
    };
    // the head count (C47): the five on the bridge round its crew screen, which stands on the nav desk
    const COUNT = { cora: { x: 230, act: 'sit', facing: 1 }, jaxon: { x: 360, act: 'console', facing: 1 }, aris: { x: 432, act: 'idle', facing: 1 },
        vance: { x: 498, act: 'idle', facing: 1 }, mira: { x: 574, act: 'idle', facing: -1 } };
    const SCREEN = { x0: 515, y0: F - 81, w: 32, h: 21 };                 // over the nav desk's chart monitor (its stand shows under it), deck-local rows
    // the galley table (as Tower.js seats them for supper)
    const TABLE = { cora: ['seatR2', 'sit'], mira: ['seatR1', 'sit'], jaxon: ['seatL2', 'sit'], aris: ['seatL1', 'sit'], vance: [{ deck: 2, x: 548, facing: -1 }, 'idle'] };

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const NS = () => window.NewScreen || null;
    const token = (name, art) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || art;
    /** A speaker's name as the frame says it ('Jaxon', 'A.U.R.A.', 'Cora') → a crew id, 'aura', or null. */
    function idOf(name) {
        const n = String(name || '').trim().toLowerCase();
        if (n === 'a.u.r.a.' || n === 'aura') return 'aura';
        if (n === 'commander' || n === 'you') return 'cora';
        const first = n.split(/\s+/)[0];
        return IDS.includes(first) ? first : null;
    }

    // ── the house dither, cached: ink (or a wash) on the pixels of an 8 x 8 Bayer step under d ──
    const dithers = new Map();
    function dither(w, h, d, hex) {
        const key = `${w}x${h}:${d}:${hex}`;
        if (dithers.has(key)) return dithers.get(key);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'), img = g.createImageData(w, h), rgb = P.hexRgb(hex);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (P.threshold(x, y) >= d) continue;
            const o = (y * w + x) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        if (dithers.size > 24) dithers.clear();
        dithers.set(key, c);
        return c;
    }
    /** A step of ink over what is already drawn, flat (source-atop: never on the clear sky round the hull). */
    function dim(ctx, x, y, w, h, a, hex) {
        if (a <= 0 || w <= 0 || h <= 0) return;
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = a; ctx.fillStyle = hex;
        ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
        ctx.restore();
    }
    /** Lay a dither over what is already drawn (source-atop: never on the clear sky round the hull). */
    function shade(ctx, x, y, w, h, d, hex) {
        if (d <= 0 || w <= 0 || h <= 0) return;
        ctx.save(); ctx.globalCompositeOperation = 'source-atop';
        ctx.drawImage(dither(Math.ceil(w), Math.ceil(h), d, hex), Math.round(x), Math.round(y));
        ctx.restore();
    }

    // ── what card is up: the bus (cards/Frame.js) ──
    const ROOM = { deck: null, speaker: null, up: false };
    function listen() {
        const ns = NS();
        if (!ns || !ns.bus) return false;
        ns.bus.on('card:deck', p => { ROOM.up = true; ROOM.deck = p && p.deck ? p.deck : null; });
        ns.bus.on('card:speaker', p => { ROOM.up = true; ROOM.speaker = idOf(p && p.name); });
        ns.bus.on('card:closed', () => { ROOM.up = false; ROOM.deck = null; ROOM.speaker = null; });
        return true;
    }
    if (!listen()) document.addEventListener('DOMContentLoaded', listen, { once: true });

    // ── the crop ──
    function pose(id, i, at, act, facing, t) {
        const s = typeof at === 'string' ? S[at] : at;
        if (!s) return null;
        const lying = act === 'sleep';
        return { id, deck: i, x: s.x, y: A.floorY(i) - (lying ? s.h || 0 : 0), act, facing: facing != null ? facing : s.facing, ms: t, z: act === 'sit' ? 1.5 : 2, say: 'card' };
    }
    /** Who the card puts in the room, and who it lights. */
    function castOf(look, i, opts) {
        const t = look.t, alive = id => look.people.some(p => p.id === id);
        if (opts.crew === 'all' && i === 0) return { cast: IDS.filter(alive).map(id => pose(id, 0, { x: COUNT[id].x, facing: COUNT[id].facing }, COUNT[id].act, null, t)), lit: [], whole: true };
        if (opts.table && i === 2) return { cast: IDS.filter(alive).map(id => pose(id, 2, TABLE[id][0], TABLE[id][1], null, t)), lit: [], whole: true };
        const who = opts.who && IDS.includes(opts.who) && alive(opts.who) ? opts.who : null;
        if (!who) return { cast: [], lit: [], whole: false };
        const [at, act] = (WHERE[i] && (WHERE[i][who] || WHERE[i].any)) || [];
        const p = pose(who, i, at, act, null, t);
        return { cast: p ? [p] : [], lit: p ? [who] : [], whole: true };   // a moment of their own: nobody else on that deck
    }
    /** The stencil on the bridge's crew screen (C47): a dark screen over the chart monitor, the words in its light. */
    function crewScreen(ctx, x0, y0, words) {
        const SCR = A.R.SCR.hex, X = SCREEN.x0 - x0, Y = A.deckTop(0) + SCREEN.y0 - y0;
        ctx.fillStyle = A.R.STEEL.hex[2]; ctx.fillRect(X - 1, Y - 1, SCREEN.w + 2, SCREEN.h + 2);
        ctx.fillStyle = SCR[1]; ctx.fillRect(X, Y, SCREEN.w, SCREEN.h);
        ctx.fillStyle = SCR[5];
        const tw = P.pixelTextWidth(words, 1);
        P.pixelText(words, X + Math.round((SCREEN.w - tw) / 2), Y + Math.round((SCREEN.h - 5) / 2), (cx, cy) => ctx.fillRect(cx, cy, 1, 1), 1);
    }
    function crop(look, deck, ctx, opts) {
        const i = DECK_I[deck];
        if (i == null || !ctx || !look || !Array.isArray(look.people)) return false;
        const o = opts || {}, t = look.t, { cast, lit, whole } = castOf(look, i, o);
        const castIds = new Set(cast.map(p => p.id));
        const people = look.people.filter(p => !castIds.has(p.id) && !(whole && p.deck === i)).concat(cast);
        const focus = cast.find(p => lit.includes(p.id));
        const x0 = Math.round(clamp(focus ? focus.x - W / 2 : whole ? (o.crew === 'all' ? 168 : 165) : X_PLAIN, X_MIN, X_MAX)), y0 = A.deckTop(i) + CROP_Y;
        const speaker = ROOM.speaker, view = { t, camY: y0, offX: -x0, W, H, people, auraTalking: !!look.auraTalking || speaker === 'aura' };
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        try {
            TW.draw(ctx, view);
            if (look.marks) MK.draw(ctx, Object.assign({}, look.marks, { t, G: { W, H }, offX: -x0, cam: y0, sunY: look.sunRow != null ? look.sunRow - y0 : -1e4, fix: null }));
            const lights = people.filter(p => p.deck === i && (lit.includes(p.id) || p.id === speaker));
            if (whole || lights.length) dim(ctx, 0, 0, W, H, DIM, token('--ink', P.INK));     // the rest of the deck a step dim
            if (lights.length) TW.drawPeople(ctx, view, lights);              // the person the card is about, and whoever speaks, lit
            if (o.screen && i === 0) crewScreen(ctx, x0, y0, String(o.screen).toUpperCase());   // the screen keeps its own light
        } catch (err) { console.error('TowerCard: the deck could not be drawn', err); ctx.restore(); return false; }
        ctx.restore();
        return true;
    }

    // ── the room answers, and the fault's flash: over the tower's own picture, after its marks ──
    let flashing = null;                                                   // { i, hex, t0 }
    function flash(deck, tone) {
        const i = DECK_I[deck];
        if (i == null) return;
        flashing = { i, hex: tone === 'gain' ? token('--warm-br', '') : token('--wash', ''), t0: performance.now() };
    }
    function draw(o, v) {
        if (!o || !v) return;
        const deckRect = i => [L.IL + v.offX, A.deckTop(i) - v.camY, L.IR - L.IL, F];
        if (ROOM.up && (ROOM.deck || ROOM.speaker)) {
            const sp = ROOM.speaker && ROOM.speaker !== 'aura' ? v.people.find(p => p.id === ROOM.speaker) : null;
            const keep = new Set([DECK_I[ROOM.deck], sp ? sp.deck : ROOM.speaker === 'aura' ? 0 : undefined].filter(n => n != null));
            o.save(); o.beginPath(); o.rect(0, 0, v.W, v.H);
            keep.forEach(i => { const [x, y, w, h] = deckRect(i); o.rect(x, y, w, h); });   // the lit decks cut out (even-odd)
            o.clip('evenodd');
            dim(o, 0, 0, v.W, v.H, ROOM_DIM, token('--ink', P.INK));
            o.restore();
            if (sp) TW.drawPeople(o, v, [sp]);
        }
        if (flashing) {
            const k = Math.floor((performance.now() - flashing.t0) / STEP_ART);
            if (k >= FLASH_STEPS.length || !flashing.hex) { flashing = null; return; }
            const [x, y, w, h] = deckRect(flashing.i);
            shade(o, x, y, w, h, FLASH_STEPS[k], flashing.hex);
        }
    }

    /** Where a chip or a find docks at a deck, in CSS px; null while the tower is not in view. */
    function edge(deck) {
        const ns = NS(), i = DECK_I[deck], tw = ns && ns.mods && ns.mods.tower;
        if (i == null || !tw || typeof tw.fit !== 'function' || !ns.anchors) return null;
        try {
            const a = ns.anchors.get('tower:deck:' + DECK_NAMES[i]), f = tw.fit();
            if (!f || !a || !(a() || []).length || (typeof ns.mode === 'function' && ns.mode() !== 'travel')) return null;
            const css = (wx, wy) => [((wx - f.tLeft) * f.ts) / f.dpr, ((wy - f.tTop) * f.ts + f.tY0) / f.dpr];
            const [x, y] = css(HULL_OUT, A.deckTop(i) + F * 0.5), [inX, inY] = css(PUT_DOWN.x, A.deckTop(i) + PUT_DOWN.y);
            return { x: Math.round(x), y: Math.round(y), inX: Math.round(inX), inY: Math.round(inY) };
        } catch (err) { console.error('TowerCard: no deck edge', err); return null; }
    }

    window.NSTowerCard = Object.freeze({ W, H, crop, draw, flash, edge, idOf, room: () => (ROOM.up ? { deck: ROOM.deck, speaker: ROOM.speaker } : null) });
})();
