/* MiniHost — plays a minigame over the running game, in one full-screen frame (styles: minigames.css).

   A minigame registers once, when its script loads:
     MiniHost.register({ id, title, kicker, mount(ctx, ui, opts), autoResult(opts) })
   and the game plays it, waiting for the result:
     const result = await MiniHost.play('corridor', { sector: 2 });
   opts.kicker and opts.title, when given, replace the minigame's own header for this one play.

   mount() draws into the 480×270 canvas through ctx, talks through ui, may return a cleanup function, and ends the
   minigame by calling ui.finish(result). That closes the frame, stops every MiniLab loop and sound, gives focus back,
   and resolves play() with result. With window.TEST_MODE on, play() opens nothing and resolves at once with autoResult(opts).

   ui = {
     say(speaker, words)  one line at a time; the line before stays faint above. speaker: a name, 'A.U.R.A.', or '' for narration
     clear()              empty the dialogue
     buttons(defs)        replace the button row. def: { label, onClick } or { label, hold: true, onDown, onUp }; primary, quiet, disabled optional
     toPixel(e)           where a pointer event landed on the picture, in picture pixels: { x, y }
     canvas               the canvas element; set onpointerdown etc. on it (it is thrown away on close)
     finish(result)       close and resolve play() with result; only the first call counts
   }
   While the frame is open every key goes to the minigame (MiniLab.keys, MiniLab.onKey) and none reaches the game. */

(function () {
    'use strict';
    const MiniLab = window.MiniLab;
    if (!MiniLab) return;

    const MARGIN = 16;              // px kept clear around the frame (the .mini-host padding in minigames.css)
    const CRISP_MIN_FILL = 0.85;    // whole device pixels per picture pixel, unless that shrinks the picture below this share of the room
    const MIN_SCALE = 0.25;
    const ROUNDING_SLACK = 0.01;    // the room is measured in fractional CSS pixels; this keeps 2.995 from flooring to 2
    const LEAVE_MS = 300;           // the fade out (the .mini-host transition in minigames.css)
    const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '];
    const AURA = 'A.U.R.A.';
    // the frame's colours come from the minigame palette, set as custom properties on the overlay
    const THEME = {
        void: '--mg-void', deep: '--mg-deep', dusk: '--mg-dusk', line: '--mg-line', line2: '--mg-line2', text: '--mg-text',
        textDim: '--mg-dim', ui: '--mg-ui', uiBright: '--mg-ui-br', uiDim: '--mg-ui-dim', warm: '--mg-warm',
    };

    const games = new Map();
    let current = null;             // id of the minigame on screen

    function register(def) {
        const isValid = def && typeof def.id === 'string' && def.id && typeof def.title === 'string'
            && typeof def.mount === 'function' && typeof def.autoResult === 'function';
        if (!isValid) throw new Error('MiniHost.register needs { id, title, kicker, mount(ctx, ui, opts), autoResult(opts) }');
        games.set(def.id, def);
    }

    /** Opens the minigame and resolves with what it passes to ui.finish(). Rejects for an unknown id or when one is already open. */
    function play(id, opts = {}) {
        const def = games.get(id);
        if (!def) return Promise.reject(new Error(`MiniHost: no minigame "${id}" is registered`));
        if (window.TEST_MODE) return new Promise(resolve => resolve(def.autoResult(opts)));
        if (current) return Promise.reject(new Error(`MiniHost: "${current}" is still open`));
        return new Promise(resolve => open(def, opts, resolve));
    }

    // ── the frame ──
    function buildOverlay(def, opts) {
        const overlay = document.createElement('div');
        overlay.className = 'mini-host';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'mini-host-title');
        Object.entries(THEME).forEach(([role, token]) => overlay.style.setProperty(token, MiniLab.C[role]));
        overlay.innerHTML = `<div class="mini-frame">
                <header class="mini-head"><p class="mini-kicker"></p><h2 class="mini-title" id="mini-host-title"></h2></header>
                <div class="mini-screen"><canvas class="mini-canvas" width="${MiniLab.W}" height="${MiniLab.H}" tabindex="0" aria-label="Minigame view"></canvas></div>
                <div class="mini-talk" aria-live="polite"><p class="mini-prev"></p><p class="mini-who"></p><p class="mini-line"></p></div>
                <div class="mini-buttons"></div>
            </div>`;
        const q = sel => overlay.querySelector(sel);
        q('.mini-kicker').textContent = opts.kicker || def.kicker || '';
        q('.mini-title').textContent = opts.title || def.title;
        return { overlay, frame: q('.mini-frame'), canvas: q('canvas'), prev: q('.mini-prev'), who: q('.mini-who'), line: q('.mini-line'), row: q('.mini-buttons') };
    }

    /** Scale the picture to fit the window, aspect kept. Whole device pixels per picture pixel when that costs little room,
        so every dither dot comes out the same size. */
    function fitCanvas(els) {
        const { frame, canvas } = els, W = MiniLab.W, H = MiniLab.H, dpr = window.devicePixelRatio || 1;
        const cs = getComputedStyle(frame), px = name => parseFloat(cs[name]) || 0;
        const chromeW = px('paddingLeft') + px('paddingRight') + px('borderLeftWidth') + px('borderRightWidth');
        const chromeH = frame.offsetHeight - canvas.offsetHeight;
        const room = Math.max(MIN_SCALE, Math.min((window.innerWidth - 2 * MARGIN - chromeW) / W, (window.innerHeight - 2 * MARGIN - chromeH) / H));
        const crisp = Math.floor(room * dpr + ROUNDING_SLACK) / dpr;
        const scale = crisp >= room * CRISP_MIN_FILL ? crisp : room;
        canvas.style.width = `${W * scale}px`;
        canvas.style.height = `${H * scale}px`;
    }

    function makeButton(def) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mini-btn' + (def.primary ? ' is-primary' : '') + (def.quiet ? ' is-quiet' : '');
        b.textContent = def.label;
        b.disabled = !!def.disabled;
        if (def.hold) {
            const down = e => { e.preventDefault(); b.classList.add('is-held'); if (def.onDown) def.onDown(); };
            const up = () => { if (!b.classList.contains('is-held')) return; b.classList.remove('is-held'); if (def.onUp) def.onUp(); };
            b.addEventListener('pointerdown', down);
            ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => b.addEventListener(type, up));
        } else if (def.onClick) {
            b.addEventListener('click', def.onClick);
        }
        return b;
    }

    function makeUi(els, finish) {
        return {
            say(speaker, words) {
                const { prev, who, line } = els, isNote = !speaker;
                if (line.textContent) prev.textContent = (who.textContent ? `${who.textContent}: ` : '') + line.textContent;
                who.textContent = speaker || '';
                who.className = 'mini-who' + (speaker === AURA ? ' is-aura' : '') + (isNote ? ' is-note' : '');
                line.textContent = words || '';
                line.className = 'mini-line' + (isNote ? ' is-note' : '');
            },
            clear() { els.prev.textContent = ''; els.who.textContent = ''; els.line.textContent = ''; },
            buttons(defs) { els.row.replaceChildren(...(defs || []).map(makeButton)); },
            toPixel(e) {
                const r = els.canvas.getBoundingClientRect();
                return { x: ((e.clientX - r.left) / r.width) * MiniLab.W, y: ((e.clientY - r.top) / r.height) * MiniLab.H };
            },
            canvas: els.canvas,
            finish,
        };
    }

    const focusQuietly = el => { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } };

    /** Keys go to the minigame and never reach the game; focus cannot leave the frame. Returns the function that lets go. */
    function trapInput(els) {
        const onKeyDown = e => {
            e.stopPropagation();
            const isOwnButton = e.target instanceof HTMLButtonElement && els.overlay.contains(e.target); // a focused button keeps Space and Enter
            if (GAME_KEYS.includes(e.key) && !isOwnButton) e.preventDefault();                          // never scroll or press the game
            MiniLab._key(e, true);
        };
        const onKeyUp = e => { e.stopPropagation(); MiniLab._key(e, false); };
        const onFocusIn = e => { if (!els.overlay.contains(e.target)) focusQuietly(els.canvas); };
        const listeners = [
            [window, 'keydown', onKeyDown, true], [window, 'keyup', onKeyUp, true], [document, 'focusin', onFocusIn, true],
            [window, 'blur', () => MiniLab.keys.clear(), false],
        ];
        listeners.forEach(([target, type, fn, capture]) => target.addEventListener(type, fn, capture));
        return () => listeners.forEach(([target, type, fn, capture]) => target.removeEventListener(type, fn, capture));
    }

    /** Refit the picture whenever the window changes size (the overlay always covers the window). Returns the function that stops. */
    function followWindow(els) {
        const observer = new ResizeObserver(() => fitCanvas(els));
        observer.observe(els.overlay);
        return () => observer.disconnect();
    }

    /** mount() threw: say so, and let the player carry on as if A.U.R.A. had played it. */
    function offerWayOut(ui, def, opts) {
        ui.say('', 'This would not start.');
        ui.buttons([{ label: 'Continue', primary: true, onClick: () => ui.finish(def.autoResult(opts)) }]);
    }

    function open(def, opts, resolve) {
        const els = buildOverlay(def, opts), returnFocus = document.activeElement;
        let cleanup = null, isDone = false, releaseInput = () => {}, stopFollowing = () => {};
        const runCleanup = () => {
            const fn = cleanup;
            cleanup = null;
            if (typeof fn === 'function') { try { fn(); } catch (e) { console.error(e); } }
        };
        function finish(result) {
            if (isDone) return;
            isDone = true;
            runCleanup();
            MiniLab._close();
            releaseInput();
            stopFollowing();
            els.overlay.classList.add('is-leaving');
            setTimeout(() => {
                els.overlay.remove();
                current = null;
                if (returnFocus && returnFocus !== document.body && returnFocus.isConnected) focusQuietly(returnFocus);
                resolve(result);
            }, LEAVE_MS);
        }

        current = def.id;
        document.body.appendChild(els.overlay);
        releaseInput = trapInput(els);
        fitCanvas(els);
        stopFollowing = followWindow(els);
        focusQuietly(els.canvas);
        MiniLab._open();
        const ctx = els.canvas.getContext('2d'), ui = makeUi(els, finish);
        ctx.fillStyle = MiniLab.C.void;
        ctx.fillRect(0, 0, MiniLab.W, MiniLab.H);
        try { cleanup = def.mount(ctx, ui, opts); } catch (e) { console.error(e); offerWayOut(ui, def, opts); }
        if (isDone) runCleanup();                                   // finish() was called inside mount()
    }

    window.MiniHost = {
        register, play,
        has: id => games.has(id),
        /** The id of the minigame on screen, or null. */
        get current() { return current; },
    };
})();
