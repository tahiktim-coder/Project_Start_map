/* ═══ Silent Exodus · new screen (?new=1) · Console.js: the ship's console, and the ship showing it saved ══════════════════
   What it is: the look pass's console (DESIGN.md 5.1 and 5.2, call C10). After the title there was no way to turn the sound
   off, change the volume or go back to the title, and nothing said the game had saved. That control is a thing of the ship:
   A.U.R.A.'s speaker in the tower's top deck (the one that glows when she speaks). No header bar, no pill.
     Opening    a click on the speaker (Tower.js), or Esc in travel or on the bridge (NewScreen.js) when NewScreen.idle(): never
                over a frame, a film, a minigame, an ending, the title, the dive, the jump or the stall.
     The frame  the Report shape of the card frame (cards/Frame.js, DESIGN 1.1), drawn here because its keys act in place: the
                house dither over the scene, and the frame's own near-ink ground under the picture and the keys (the keys never
                sit straight on the art behind the veil); the picture, 480 x 160 at a whole scale (2x from 1040 px wide; the
                middle 120 rows under 640 px tall), the bridge deck, live at the art's 8 fps: in travel cropped from the
                tower's own picture (the crew at work, her speaker lit while the console is up); on the bridge cropped from the
                bridge itself (the crew at the glass, the desks). One readout `A.U.R.A.`; then the keys (minigames.css
                .mini-btn): [› Resume] framed and focused, › Sound off / › Sound on, › Volume with its step as a Mono chip
                (three steps), › Save and return to title. The words over the scene (#ns-words: the bridge's tags and keys,
                voice lines, notes) hide while it is up, and the bridge leaves its tags' pixels out (Stop.js: NS.blocked()).
     Keys       Esc or Resume close it; Tab, Shift+Tab and the arrows move; Enter or Space press. Pointing at a key focuses it,
                so focus looks exactly like pointing, but only once the pointer has really moved since the console opened: a
                key that appears under a resting cursor never takes the focus from Resume (Esc, then Enter, resumes), and a
                key under the cursor that does not have the focus stays plain (one warm key). Nothing is taken in the first
                400 ms (ChoiceGuard).
     Sound      the game's own AudioSystem (toggleMute, setMusicVolume, the master gain, as the old sound panel did); the
                choice is kept in localStorage 'psm-muted' (the key AudioSystem reads on load) and 'psm-volume', so a
                return to the title keeps it.
     Title      saves (GameState.saveGame, the autosave's own call), then reloads into the title, the way every end screen
                goes back; a try tab asks bundle.js for its title once (sessionStorage 'se-to-title': TITLE_ASKED).
     Saved      bundle.js autoSave emits 'saved'; once the tower is in view (and has been for 600 ms) the speaker and its ring
                blink twice in art steps (Tower.js draws glow() while lit(t): the grille's slats lit and a dithered ring round
                it, big enough to see at 720p; pointing at the speaker lights it the same way), and the first time in a
                session only a Mono 14 chip `saved` shows under the speaker for 1.5 s.
     Motion     steps only: the veil 3 steps in and out, the picture's Bayer reveal 2 art steps, the chip 2 steps.
   Loaded only when the new-screen switch is on, after tower/Tower.js.

   window.NSConsole (frozen)
     open(by) → bool      by: 'esc' | 'speaker'; false when it may not open now
     close()
     isOpen() → bool
     lit(t) → bool        the speaker lit at NewScreen.clock.t (the console up, or a save's blink on its on step): Tower.js
     glow(ctx, cx, bot)   her speaker lit up in the tower's picture (tower art px: the grille's middle and its foot): Tower.js
     remember()           keeps the mute choice and puts the volume step back over AudioSystem's full gain (the title's toggle)
     debug() → { open, step, muted, focus, sound, volume, pending, blinking, chipShown, saves, moved }
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const PIC_W = 480, PIC_H = 160, WHOLE_AT = 1040, CROP_UNDER = 640, CROP_ROWS = 120;
    const CROP = { x: 172, y: 32 };                       // the bridge deck (deck 0), tower px from its top: both windows' bays, the desks, the speaker
    const BRIDGE = { x: 40, y: 168 };                     // on the bridge: the room itself (Stop.js's 640 x 360 frame px): the glass's foot, the crew, the desks
    const GRILLE = { half: 6, h: 16, ring: 13, n: 84 };   // her speaker in the tower's art (ShipRooms deck 0: grille 602-614 x F-134..F-118, its lamp at F-138)
    const STEP_UI = 60, STEP_ART = 125, VEIL_STEPS = 3, REVEAL_STEPS = 2, CHIP_STEPS = 2, GUARD_MS = 400;
    const BLINK = [1, 1, 0, 0, 1, 1];                     // the save blink, in art steps: on, off, on (twice)
    const CHIP_MS = 1500, SETTLE_MS = 600, WATCH_MS = 100, STAR_N = 70, STAR_SEED = 33366;
    const VOLUME = [0.3, 0.6, 1], MASTER = 0.3, MUSIC = 0.15;   // three steps of the old sound panel's full scale (master 0.3, music 0.15)
    const STORE = { muted: 'psm-muted', volume: 'psm-volume', title: 'se-to-title' };
    const WORDS = Object.freeze({                         // C10 (CALLS.md): the keys, the readout, the saved chip
        resume: 'Resume', soundOff: 'Sound off', soundOn: 'Sound on', volume: 'Volume', title: 'Save and return to title',   // DRAFT (look pass): C10's keys
        readout: 'A.U.R.A.', saved: 'saved', aria: "The ship's console",   // DRAFT (look pass): C10's readout and chip; aria is read aloud only
    });
    const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map(v => (v + 0.5) / 64);

    const S = { el: null, btns: [], keys: null, art: null, cover: null, open: false, closing: false, leaving: false, timers: new Set(), paintId: 0,
        step: VOLUME.length, pending: false, watchId: 0, seenAt: null, blinkT0: null, chipDone: false, chip: null, saves: 0, ptr: null, rest: null, moved: false };
    const NS = () => window.NewScreen || null;
    const AS = () => window.AudioSystem || null;
    const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const tok = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const later = (ms, fn) => { const id = setTimeout(() => { S.timers.delete(id); fn(); }, ms); S.timers.add(id); return id; };
    function read(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
    function keep(key, v) { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch (err) { /* storage blocked: this load only */ } }
    function stallNow() { const st = window.NSStall; try { return !!(st && typeof st.view === 'function' && st.view()); } catch (err) { return false; } }

    // ── sound: the game's own AudioSystem ──
    function applyVolume() {
        const a = AS(), v = VOLUME[S.step - 1];
        if (!a) return;
        try {
            a.setMusicVolume(MUSIC * v);
            if (!a.muted && a.masterGain && a.ctx) a.masterGain.gain.setValueAtTime(MASTER * v, a.ctx.currentTime);
        } catch (err) { console.error('NSConsole: the volume failed', err); }
    }
    function remember() {
        const a = AS();
        if (!a) return;
        keep(STORE.muted, a.muted ? '1' : null);
        applyVolume();                                    // unmute puts the master gain back to full: the step goes over it again
    }
    function toggleSound() {
        const a = AS();
        if (!a) return;
        try { a.toggleMute(); } catch (err) { console.error('NSConsole: the sound toggle failed', err); return; }
        remember();
        label();
    }
    function nextVolume() {
        S.step = S.step > 1 ? S.step - 1 : VOLUME.length;   // down first (3, 2, 1, then 3 again): the likely wish is quieter
        keep(STORE.volume, String(S.step));
        applyVolume();
        label();
    }

    // ── the frame ──
    function markup() {
        const k = (act, cls, html) => `<button type="button" class="mini-btn${cls}" data-act="${act}">${html}</button>`;
        return `<section class="nc-frame" role="dialog" aria-modal="true" aria-label="${WORDS.aria}">
            <div class="nc-pic"><canvas class="nc-art" width="${PIC_W}" height="${PIC_H}" aria-hidden="true"></canvas><canvas class="nc-cover" width="${PIC_W}" height="${PIC_H}" aria-hidden="true"></canvas><p class="nc-readout">${WORDS.readout}</p></div>
            <div class="nc-keys">${k('resume', ' is-primary', WORDS.resume)}${k('sound', '', '<span class="nc-w"></span>')}${k('volume', '', `<span>${WORDS.volume}</span><i class="nc-chip"></i>`)}${k('title', '', WORDS.title)}</div>
        </section>`;
    }
    function label() {
        if (!S.el) return;
        const a = AS(), muted = !!(a && a.muted), sound = S.el.querySelector('[data-act="sound"]');
        sound.querySelector('.nc-w').textContent = muted ? WORDS.soundOn : WORDS.soundOff;   // the key says what it does: no aria-pressed beside it
        S.el.querySelector('.nc-chip').textContent = `${S.step}/${VOLUME.length}`;
    }
    function layout() {
        if (!S.el) return;
        const k = innerWidth >= WHOLE_AT ? 2 : 1, crop = innerHeight < CROP_UNDER, f = S.el.querySelector('.nc-frame');
        f.style.setProperty('--pic-k', String(k));
        f.style.setProperty('--pic-w', `${PIC_W * k}px`);
        f.style.setProperty('--pic-h', `${(crop ? CROP_ROWS : PIC_H) * k}px`);
        f.style.setProperty('--pic-crop', `${crop ? ((PIC_H - CROP_ROWS) / 2) * k : 0}px`);
    }

    // ── the picture: the bridge deck from the tower's picture (Tower.js crop), over a few stars for its windows ──
    let starCanvas = null;
    function stars() {
        if (starCanvas) return starCanvas;
        const c = document.createElement('canvas'), x = c.getContext('2d'), tones = [tok('--faint'), tok('--dim'), tok('--ui')];
        c.width = PIC_W; c.height = PIC_H;
        let s = STAR_SEED;
        const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
        for (let i = 0; i < STAR_N; i++) { x.fillStyle = tones[Math.min(2, Math.floor(rnd() * rnd() * 3.4))]; x.fillRect(Math.floor(rnd() * PIC_W), Math.floor(rnd() * PIC_H), 1, 1); }
        starCanvas = c;
        return c;
    }
    function paint() {
        const ctx = S.art && S.art.getContext('2d'), A = window.ShipArt, N = NS(), T = N && N.mods && N.mods.tower;
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = tok('--ink'); ctx.fillRect(0, 0, PIC_W, PIC_H);
        ctx.drawImage(stars(), 0, 0);
        if (!A) return;
        try {
            if (N && N.mode() === 'stop' && fromBridge(ctx)) return;      // on the bridge: the room as it is now (the tower is not drawn there: an old crew would show)
            const R = window.ShipRoutine, look = R ? ((R.stateOf('travel').looks || {})[0] || {}) : {};   // the tower's own look: its cached painting
            ctx.drawImage(A.deck(0, look).canvas, CROP.x, CROP.y, PIC_W, PIC_H, 0, 0, PIC_W, PIC_H);         // the room
            if (N && N.mode() === 'travel' && T && typeof T.crop === 'function') T.crop(ctx, CROP.x, A.deckTop(0) + CROP.y, PIC_W, PIC_H);   // in travel, as the tower draws it now: the crew, the lit speaker
        } catch (err) { console.error('NSConsole: the picture failed', err); }
    }
    /** The bridge's own canvas (Stop.js: the 640 x 360 frame at 1:1, centred on canvas#ns-bridge) at BRIDGE; false: not there. */
    function fromBridge(ctx) {
        const cv = document.getElementById('ns-bridge'), GL = window.NSGlass;
        if (!cv || !GL || cv.width < GL.SW || cv.height < GL.SH) return false;
        ctx.drawImage(cv, Math.floor((cv.width - GL.SW) / 2) + BRIDGE.x, Math.floor((cv.height - GL.SH) / 2) + BRIDGE.y, PIC_W, PIC_H, 0, 0, PIC_W, PIC_H);
        return true;
    }
    /** Her speaker lit up, in the tower's picture (tower art px; cx, bot: the grille's middle and foot): the grille's slats lit
        and a dithered ring round grille and lamp. TowerArt lights the lamp itself; this is what reads at 0.54x (720p). */
    function glow(ctx, cx, bot) {
        const A = window.ShipArt, hex = A && A.R && A.R.SCR ? A.R.SCR.hex : null;
        if (!ctx || !hex) return;
        ctx.fillStyle = hex[4];
        for (let y = bot - GRILLE.h; y < bot; y += 2) ctx.fillRect(cx - GRILLE.half, y, GRILLE.half * 2, 1);
        const cy = bot - GRILLE.h / 2 - 2;
        ctx.fillStyle = hex[3];
        for (let i = 0; i < GRILLE.n; i += 2) {
            const a = (i / GRILLE.n) * Math.PI * 2;
            ctx.fillRect(Math.round(cx + Math.cos(a) * GRILLE.ring), Math.round(cy + Math.sin(a) * GRILLE.ring), 1, 1);
        }
    }
    /** The picture's Bayer reveal: step k of n shows the art where the matrix is under k / n, ink elsewhere. */
    function coverAt(k, n) {
        const ctx = S.cover && S.cover.getContext('2d');
        if (!ctx) return;
        if (k >= n) { ctx.clearRect(0, 0, PIC_W, PIC_H); return; }
        const img = ctx.createImageData(PIC_W, PIC_H), d = img.data, lim = k / n, ink = tok('--ink').replace('#', '');
        const rgb = [0, 2, 4].map(i => parseInt(ink.slice(i, i + 2), 16) || 0);
        for (let y = 0; y < PIC_H; y++) for (let x = 0; x < PIC_W; x++) {
            if (BAYER[((y & 7) << 3) | (x & 7)] < lim) continue;
            const o = (y * PIC_W + x) * 4;
            d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }

    // ── open, close, the title ──
    function canOpen() {
        const N = NS();
        return !!(N && typeof N.idle === 'function' && N.idle() && !stallNow() && !S.el);
    }
    function open(by) {
        if (!canOpen()) return false;
        const el = document.createElement('div');
        el.className = 'ns-console';
        el.dataset.by = by || 'esc';
        el.innerHTML = markup();
        document.body.appendChild(el);
        Object.assign(S, { el, open: true, closing: false, leaving: false, keys: el.querySelector('.nc-keys'), art: el.querySelector('.nc-art'), cover: el.querySelector('.nc-cover') });
        S.btns = [...el.querySelectorAll('.mini-btn')];
        Object.assign(S, { rest: S.ptr ? S.ptr.slice() : null, moved: false });   // where the cursor rests as it opens: a key there is not pointed at yet
        S.btns.forEach(b => {
            b.addEventListener('click', () => press(b.dataset.act));
            b.addEventListener('pointermove', e => point(b, e));          // pointing is focusing: one warm key
        });
        label(); layout(); paint();
        const rm = reduced();
        coverAt(rm ? 1 : 0, 1);
        if (!rm) for (let s = 1; s <= REVEAL_STEPS; s++) later(VEIL_STEPS * STEP_UI + (s - 1) * STEP_ART, () => coverAt(s, REVEAL_STEPS));
        S.paintId = setInterval(paint, STEP_ART);         // live at the art's 8 fps (the tower draws under it every 12th frame)
        if (window.ChoiceGuard) window.ChoiceGuard.hold(S.keys, GUARD_MS);
        S.btns[0].focus({ preventScroll: true });
        addEventListener('keydown', onKey, true);
        addEventListener('resize', layout);
        return true;
    }
    function close() {
        if (!S.el || S.closing) return;
        S.closing = true;
        S.el.classList.add('is-out');
        later(reduced() ? 0 : VEIL_STEPS * STEP_UI, finish);
    }
    function finish() {
        clearInterval(S.paintId); S.paintId = 0;
        S.timers.forEach(id => clearTimeout(id)); S.timers.clear();
        removeEventListener('keydown', onKey, true);
        removeEventListener('resize', layout);
        if (S.el) S.el.remove();
        Object.assign(S, { el: null, btns: [], keys: null, art: null, cover: null, open: false, closing: false });
    }
    function toTitle() {
        if (S.leaving) return;
        const N = NS(), app = (N && N.app) || window.app;
        let saved = false;
        try { saved = !!(app && app.state && app.state.saveGame()); } catch (err) { console.error('NSConsole: the save failed', err); }
        if (!saved) { console.error('NSConsole: the run did not save; staying aboard'); return; }
        S.leaving = true;
        try { sessionStorage.setItem(STORE.title, '1'); } catch (err) { /* storage blocked: a try tab opens on its moment again */ }
        S.el.classList.add('is-leaving');
        setTimeout(() => location.reload(), reduced() ? 0 : VEIL_STEPS * STEP_UI);   // like every end screen: the title comes with the load
    }
    function press(act) {
        if (!S.open || S.closing || S.leaving) return;
        if (act === 'resume') close();
        else if (act === 'sound') toggleSound();
        else if (act === 'volume') nextVolume();
        else if (act === 'title') toTitle();
    }
    /** A pointer move over key b focuses it once the pointer has really moved since the console opened (a key that came up
        under a resting cursor, or the browser's own hover update, takes nothing from Resume). */
    function point(b, e) {
        if (S.closing || S.leaving) return;
        if (!S.moved) {
            if (!S.rest) { S.rest = [e.clientX, e.clientY]; return; }   // nothing seen before it opened: this one is where it rests
            if (Math.abs(e.clientX - S.rest[0]) < 1 && Math.abs(e.clientY - S.rest[1]) < 1) return;
            S.moved = true;
        }
        if (document.activeElement !== b) b.focus({ preventScroll: true });
    }
    function move(d) {
        const at = S.btns.indexOf(document.activeElement), n = S.btns.length;
        S.btns[at < 0 ? (d > 0 ? 0 : n - 1) : (at + d + n) % n].focus({ preventScroll: true });
    }
    function onKey(e) {
        if (!S.open) return;
        e.stopPropagation();                              // the game under the console hears nothing
        if (S.closing || S.leaving) return;
        const k = e.key, own = () => e.preventDefault();
        if (k === 'Escape') { own(); if (!e.repeat) close(); }
        else if (k === 'Tab') { own(); move(e.shiftKey ? -1 : 1); }
        else if (k === 'ArrowRight' || k === 'ArrowDown') { own(); move(1); }
        else if (k === 'ArrowLeft' || k === 'ArrowUp') { own(); move(-1); }
        else if ((k === 'Enter' || k === ' ') && !S.btns.includes(document.activeElement)) { own(); S.btns[0].focus({ preventScroll: true }); }
    }

    // ── saved: the speaker blinks twice once the tower is in view; the first time in a session, the chip under it ──
    function speaker() {
        const N = NS(), f = N && N.anchors && N.anchors.get('tower:speaker'), pts = f ? f() : [];
        return pts && pts.length ? pts[0] : null;
    }
    function inView() { const N = NS(); return !!(N && N.idle() && N.mode() === 'travel' && !stallNow() && speaker()); }
    function onSaved() {
        S.saves += 1;
        S.pending = true;
        if (!S.watchId) S.watchId = setInterval(watch, WATCH_MS);
    }
    function watch() {
        const N = NS();
        if (!S.pending || !N) { clearInterval(S.watchId); S.watchId = 0; return; }
        if (S.blinkT0 != null || !inView()) { S.seenAt = null; return; }
        if (S.seenAt == null) S.seenAt = performance.now();
        if (performance.now() - S.seenAt < SETTLE_MS) return;
        S.pending = false; S.seenAt = null;
        S.blinkT0 = Math.ceil(N.clock.t / STEP_ART) * STEP_ART;   // on the art's own steps
        if (!S.chipDone) { S.chipDone = true; showChip(speaker()); }
    }
    function lit(t) {
        if (S.open) return true;
        if (S.blinkT0 == null) return false;
        const i = Math.floor((t - S.blinkT0) / STEP_ART);
        if (i >= BLINK.length || t < S.blinkT0 - STEP_ART) { S.blinkT0 = null; return false; }   // over (or the clock went back)
        return i >= 0 && BLINK[i] === 1;
    }
    function showChip(at) {
        const layer = document.getElementById('ns-ship-words');
        if (!layer || !at) return;
        dropChip();
        const el = document.createElement('i');
        el.className = 'nc-saved';
        el.textContent = WORDS.saved;
        layer.append(el);
        el.style.transform = `translate(${Math.round(at.x - el.offsetWidth / 2)}px, ${Math.round(at.y + 4)}px)`;
        el.classList.add('is-in');
        S.chip = { el, t1: setTimeout(() => { el.classList.add('is-out'); S.chip.t2 = setTimeout(dropChip, reduced() ? 0 : CHIP_STEPS * STEP_UI); }, CHIP_MS) };
    }
    function dropChip() {
        if (!S.chip) return;
        clearTimeout(S.chip.t1); clearTimeout(S.chip.t2);
        S.chip.el.remove();
        S.chip = null;
    }

    function style() {
        if (document.getElementById('ns-console-style')) return;
        const shade = 'repeating-conic-gradient(color-mix(in srgb, var(--ink) 92%, transparent) 0 25%, color-mix(in srgb, var(--ink) 62%, transparent) 0 50%) 0 0 / 2px 2px';
        const st = document.createElement('style'); st.id = 'ns-console-style';
        st.textContent = `html.ns-on .ns-console { position: fixed; inset: 0; z-index: 3500; display: flex; align-items: center; justify-content: center; overflow: hidden auto; background: var(--veil); color: var(--text); font-family: var(--f-text); text-align: left; -webkit-font-smoothing: antialiased; animation: nc-in calc(3 * var(--step-ui)) steps(3, end) both; }
html.ns-on .ns-console.is-out { animation: nc-out calc(3 * var(--step-ui)) steps(3, end) both; }
html.ns-on body:has(.ns-console) #ns-words { visibility: hidden; }
html.ns-on .ns-console.is-leaving { background: var(--ink); }
html.ns-on .ns-console.is-leaving .nc-frame { animation: nc-out calc(3 * var(--step-ui)) steps(3, end) both; }
@keyframes nc-in { from { opacity: 0; } }
@keyframes nc-out { to { opacity: 0; } }
html.ns-on .nc-frame {
    --mg-words: var(--text); --mg-quiet: var(--dim); --mg-faint: var(--dim); --mg-steel: var(--ui); --mg-amber: var(--warm); --mg-amber-br: var(--warm-br);
    --mg-f-ui: var(--f-ui); --mg-f-text: var(--f-text); --mg-f-num: var(--f-num); --mg-shadow: var(--shadow); --mg-ease: var(--ease);
    --pic-w: 960px; --pic-h: 320px; --pic-k: 2; --pic-crop: 0px;
    position: relative; display: grid; gap: var(--s4); width: var(--pic-w); margin: calc(2 * var(--s4)) 0; isolation: isolate;
}
html.ns-on .nc-frame::before {
    content: ''; position: absolute; z-index: -1; pointer-events: none; inset: calc(-1 * var(--s4));
    border: var(--s1) solid transparent;
    background:
        repeating-conic-gradient(color-mix(in srgb, var(--ink) 97%, transparent) 0 25%, color-mix(in srgb, var(--ink) 90%, transparent) 0 50%) 0 0 / 2px 2px padding-box,
        repeating-conic-gradient(color-mix(in srgb, var(--ink) 94%, transparent) 0 25%, transparent 0 50%) 0 0 / 4px 4px border-box;
}
html.ns-on .nc-pic { position: relative; width: var(--pic-w); height: var(--pic-h); overflow: hidden; background: var(--ink); box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui) 7%, transparent); }
html.ns-on .nc-pic canvas { position: absolute; left: 0; top: calc(-1 * var(--pic-crop)); width: var(--pic-w); height: calc(var(--pic-k) * ${PIC_H}px); image-rendering: pixelated; image-rendering: crisp-edges; }
html.ns-on .nc-readout { position: absolute; left: var(--s2); top: var(--s2); z-index: 1; margin: 0; padding: 3px 6px 2px; font: 400 var(--fs-readout)/1.2 var(--f-num); letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; color: var(--ui); background: ${shade}; text-shadow: var(--shadow); }
html.ns-on .nc-keys { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s3) var(--s8); }
html.ns-on .nc-frame .mini-btn { font-size: var(--fs-key); transition: none; }
html.ns-on .nc-frame .mini-btn::before { transition: none; }
html.ns-on .nc-frame .mini-btn:focus-visible { text-decoration: none; }
html.ns-on .nc-frame .mini-btn:focus:not(:active) { color: var(--warm); transform: translateX(3px); outline: none; }
html.ns-on .nc-frame .mini-btn:focus:not(:active)::before { color: var(--warm); }
html.ns-on .nc-frame .mini-btn.is-primary:focus:not(:active) { border-color: var(--warm); background: color-mix(in srgb, var(--warm) 16%, transparent); }
html.ns-on .nc-frame .mini-btn:hover:not(:focus) { color: var(--mg-words); transform: none; }
html.ns-on .nc-frame .mini-btn:not(.is-primary):hover:not(:focus)::before { color: var(--mg-faint); }
html.ns-on .nc-frame .mini-btn.is-primary:hover:not(:focus) { border-color: color-mix(in srgb, var(--warm) 55%, transparent); background: color-mix(in srgb, var(--warm) 8%, transparent); }
html.ns-on .nc-chip { font: 400 var(--fs-chip)/1 var(--f-num); font-style: normal; letter-spacing: 0; color: var(--ui); }
html.ns-on #ns-ship-words .nc-saved { position: absolute; left: 0; top: 0; margin: 0; padding: 2px 5px 1px; font: 400 var(--fs-floor)/1.2 var(--f-num); font-style: normal; color: var(--ui); background: ${shade}; text-shadow: var(--shadow); white-space: nowrap; pointer-events: none; }
html.ns-on #ns-ship-words .nc-saved.is-in { animation: nc-in calc(${CHIP_STEPS} * var(--step-ui)) steps(${CHIP_STEPS}, end) both; }
html.ns-on #ns-ship-words .nc-saved.is-out { animation: nc-out calc(${CHIP_STEPS} * var(--step-ui)) steps(${CHIP_STEPS}, end) both; }
@media (prefers-reduced-motion: reduce) { html.ns-on .ns-console, html.ns-on .ns-console .nc-frame, html.ns-on #ns-ship-words .nc-saved { animation: none !important; } }`;
        document.head.appendChild(st);
    }

    // ── at load: the look, the kept volume step, the bus ──
    style();
    addEventListener('pointermove', e => { S.ptr = [e.clientX, e.clientY]; }, { capture: true, passive: true });   // where the cursor rests (open: point)
    const kept = Number(read(STORE.volume));
    if (kept >= 1 && kept < VOLUME.length) { S.step = kept; applyVolume(); }
    function attach() {
        const N = NS();
        if (!N || !N.bus) { console.error('NSConsole: NewScreen is missing; no save blink'); return; }
        N.bus.on('saved', onSaved);
        N.bus.on('hidden', dropChip);
        N.bus.on('resize', dropChip);
    }
    if (NS()) attach(); else document.addEventListener('DOMContentLoaded', attach, { once: true });

    function debug() {
        const a = AS(), f = document.activeElement;
        return { open: S.open, step: S.step, muted: a ? !!a.muted : null, focus: S.btns.includes(f) ? f.dataset.act : null,
            sound: S.el ? S.el.querySelector('[data-act="sound"]').textContent : null, volume: S.el ? S.el.querySelector('.nc-chip').textContent : null,
            pending: S.pending, blinking: S.blinkT0 != null, chipShown: !!S.chip, chipDone: S.chipDone, saves: S.saves, moved: S.moved };
    }
    window.NSConsole = Object.freeze({ open, close, isOpen: () => S.open, lit, glow, remember, debug, WORDS });
})();
