/* ═══ Silent Exodus · new screen (?new=1) · start/PodWords.js: the wake-up's panel and words, in the bridge's tag language ══
   What it is: everything to read or click in the wake-up (start/Pods.js), made the way the bridge's glass tags are
   (stop/Tags.js, stop/TagArt.js): corner brackets, the ink dither behind, pixel icons, words in capitals that type on.
   - The pod panel: it hangs over the pod being woken, a short thread down to the pod's top. In it, the sleeper's first name
     in their colour and three stage marks; a small screen (the stock display's recipe) with ONE reading ("Body 31°C: too
     cold", "Fluid in the lungs", "Heart 38: too slow"), typed on; under it three lit valve plates, each with its icon:
     WARM (amber), FLUSH (blue), WAKE (green). A wrong valve: the brackets flash red (steady red with reduced motion) and
     "groggy" shows by the name until the pod opens.
   - "Let A.U.R.A. do it": a quiet grey tag under the hold's intercom (her voice in the hold), threaded to it; always there.
   - Pointing at a sleeping pod: brackets round it and the sleeper's name over it. Each crew pod is also a real button
     (keyboard, screen readers); the valves too (keys 1, 2, 3 as well, Pods.js).
   - The black card's words ("Sixty-one years later") and, on later new games, "Skip the wake-up" in the corner.
   Box sizes are whole frame px (the bridge's pixel), measured from the words, so the pixels sit exactly round them.
   Loaded only when the new-screen switch is on, after start/PodArt.js, before start/Pods.js.

   window.NSPodWords (frozen)
     create(ctx) → words   ctx: { css(x, y) → [cx, cy] CSS px of a frame point, unit() → CSS px per frame px,
                                  onValve(key), onPod(i), onAura(), onSkip(), onHover(i | null) }
     words.init(layer)     the DOM in #ns-wake-words
     words.update(vm, t)   lay out and show what the scene says now (vm below); returns the layout (frame px)
     words.under(c, t)     the pixels under the people: the brackets round the pod pointed at
     words.over(c, t)      the pixels over them: the A.U.R.A. tag and the panel (shades, brackets, screen, plates, marks, thread)
     words.hide()          everything off;  words.typedAll() → the reading is all there (a valve may be opened)
     words.rects() → { panel, read, valves: { key: rect }, aura, skip, pods: [rect], card, typed, text }   CSS (headless runs)
   vm = { card: { text, a } | null, skip: bool, aura: { on }, hover: pod index | null, pods: [bool clickable] (5),
          tones: { id → '#hex' }, invite: bool (the clickable pods' brackets breathe: nothing opened yet),
          panel: null | { i, id, name, tone, reading: { text, verdict }, readAt, marks: [hex | null] x 3, next,
                         groggy, lock, auto, down: key | null, alarm: ms into the alarm | null, pulse: { hex, k } | null, shownAt } }
   The panel's box (.nsw-panel) and the A.U.R.A. tag carry the class 'sw': the voice keeps its lines off them (Voice.js).
*/
(function () {
    'use strict';
    const PA = window.NSPodArt, TA = window.NSTagArt;
    if (!window.NEW_SCREEN || !PA || !TA) return;
    const { SW, PODS, FLUID, INTERCOM } = PA;
    const VALVES = Object.freeze([{ key: 'warm', word: 'Warm' }, { key: 'flush', word: 'Flush' }, { key: 'wake', word: 'Wake' }]);
    const PAD = { x: 5, top: 4, bottom: 5 }, HEAD_H = 9, SCR_GAP = 3, SCR_H = 15, VAL_GAP = 5, VAL_H = 17, PLATE_GAP = 4, ICON_X = 4, TEXT_X = 15;
    const THREAD = 12, EDGE = 6, TYPE_MS = 26, TYPE_DELAY = 140, ARM_MS = 170, AURA_AT = { x: 14, y: INTERCOM.y + INTERCOM.h + 8 };
    const COOL = '#a9b6bc', ALARM = '#e2574c', INVITE = '#8a5a2c', GROGGY = 'groggy · +1 stress', WRONG = 'Wrong fluid';   // INVITE: a dim amber, under the bright one pointed at
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const still = () => !!(mq && mq.matches);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    function style() {
        if (document.getElementById('ns-podwords-style')) return;
        const st = document.createElement('style');
        st.id = 'ns-podwords-style';
        st.textContent = `#ns-wake-words { --fs-tag: calc(14px + 2px * var(--t, 1)); --fs-read: calc(14px + 2px * var(--t, 1)); --fs-valve: calc(12px + 2px * var(--t, 1)); }
#ns-wake-words .nsw { position: absolute; left: 0; top: 0; box-sizing: border-box; margin: 0; white-space: nowrap; text-shadow: 0 1px 0 #05070a; opacity: 0; pointer-events: none; transition: opacity 180ms steps(3, end); }
#ns-wake-words .nsw.on { opacity: 1; }
#ns-wake-words :where(button.nsw) { padding: 0; background: none; border: 0; border-radius: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#ns-wake-words button.nsw.on { pointer-events: auto; }
#ns-wake-words button.nsw:focus-visible { outline: none; }
#ns-wake-words .nsw-card { left: 50%; top: 50%; font: 300 calc(20px + 8px * var(--t, 1))/1 var(--f-text); letter-spacing: 0.34em; text-transform: uppercase; color: #c9cccd; transition: none; transform: translate(-50%, -50%); }
#ns-wake-words .nsw-head { display: flex; align-items: baseline; gap: 0.7em; }
#ns-wake-words .nsw-name { font: 600 var(--fs-tag)/1 var(--f-ui); letter-spacing: 0.16em; text-transform: uppercase; color: var(--who, #c9d1d6); }
#ns-wake-words .nsw-groggy { font: 500 calc(var(--fs-tag) - 2px)/1 var(--f-ui); letter-spacing: 0.08em; color: #ff7a6a; }
#ns-wake-words .nsw-groggy:empty { display: none; }
#ns-wake-words .nsw-read { font: 400 var(--fs-read)/1 var(--f-num); letter-spacing: 0.02em; color: #cfeef2; text-shadow: 0 0 6px rgba(127, 224, 230, 0.35), 0 1px 0 #05070a; }
#ns-wake-words .nsw-read i { font-style: normal; color: #ffc27a; text-shadow: 0 0 6px rgba(255, 194, 122, 0.35), 0 1px 0 #05070a; }
#ns-wake-words .nsw-read em { font-style: normal; color: #ff7a6a; text-shadow: 0 0 7px rgba(255, 90, 70, 0.55), 0 1px 0 #05070a; }
#ns-wake-words .nsw-read .tg-k { display: inline-block; width: 0.55em; height: 0.95em; margin-right: -0.55em; vertical-align: -0.1em; background: currentColor; }
#ns-wake-words .nsw-read .tg-r { visibility: hidden; }
#ns-wake-words .nsw-valve { display: flex; align-items: center; font: 600 var(--fs-valve)/1 var(--f-ui); letter-spacing: 0.16em; text-transform: uppercase; color: var(--fluid); }
#ns-wake-words .nsw-valve:disabled { cursor: default; }
#ns-wake-words .nsw-valve.is-hot { color: #fff6e8; }
#ns-wake-words .nsw-valve.is-dim.on { opacity: 0.5; }
#ns-wake-words .nsw-aura { font: 600 calc(13px + 1px * var(--t, 1))/1 var(--f-ui); letter-spacing: 0.16em; text-transform: uppercase; color: ${COOL}; display: flex; align-items: center; }
#ns-wake-words .nsw-aura.is-hot { color: #e6ecee; }
#ns-wake-words .nsw-who { font: 600 calc(13px + 2px * var(--t, 1))/1 var(--f-ui); letter-spacing: 0.16em; text-transform: uppercase; color: var(--who, #c9d1d6); transform-origin: 50% 100%; }
#ns-wake-words .nsw-pod.on { opacity: 0; }
#ns-wake-words .nsw-panel { padding: 0; }
#ns-wake-words .nsw-probe { position: absolute; left: -9999px; top: 0; visibility: hidden; white-space: nowrap; pointer-events: none; }
#ns-wake-words .nsw-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
#ns-wake-words .nsw-skip { left: auto; top: auto; right: 28px; bottom: 22px; padding: 6px 0; font: 500 calc(12px + 2px * var(--t, 1))/1 var(--f-ui); letter-spacing: 0.2em; text-transform: uppercase; color: #8b8d90; transition: opacity 180ms steps(3, end), color 140ms ease; }
#ns-wake-words .nsw-skip:hover, #ns-wake-words .nsw-skip:focus-visible { color: var(--warm, #f08c2e); }
@media (prefers-reduced-motion: reduce) { #ns-wake-words .nsw, #ns-wake-words .nsw-skip { transition: none; } }`;
        document.head.appendChild(st);
    }

    function create(ctx) {
        let layer = null, D = null, last = null, measured = null, typed = { text: '', n: -1, at: 0 }, hot = { valve: null, aura: false, pod: null };
        const el = (tag, cls, text) => { const e = document.createElement(tag); e.className = 'nsw ' + cls; if (text != null) e.textContent = text; layer.appendChild(e); return e; };
        const stop = e => e.stopPropagation();
        function button(cls, text, label, fn) {
            const b = el('button', cls, text);
            b.type = 'button'; b.tabIndex = -1;
            if (label) b.setAttribute('aria-label', label);
            b.addEventListener('pointerdown', stop);
            b.addEventListener('click', e => { e.stopPropagation(); if (!b.disabled) fn(); });
            return b;
        }
        function init(el0) {
            style();
            layer = el0;
            D = {
                card: el('p', 'nsw-card'),
                panel: el('div', 'nsw-panel'),
                read: el('p', 'nsw-read'),
                valves: VALVES.map(v => {
                    const b = button('nsw-valve is-' + v.key, v.word, `Open the ${v.word.toLowerCase()} valve`, () => ctx.onValve(v.key));
                    b.style.setProperty('--fluid', FLUID[v.key]);
                    b.addEventListener('pointerenter', () => { hot.valve = v.key; });
                    b.addEventListener('pointerleave', () => { if (hot.valve === v.key) hot.valve = null; });
                    b.addEventListener('focus', () => { hot.valve = v.key; });
                    b.addEventListener('blur', () => { if (hot.valve === v.key) hot.valve = null; });
                    return b;
                }),
                aura: button('nsw-aura', 'Let A.U.R.A. do it', 'Let A.U.R.A. wake the rest of the crew', () => ctx.onAura()),
                who: el('p', 'nsw-who'),
                pods: PODS.map((p, i) => {
                    const b = button('nsw-pod', '', i ? `Wake ${p.id.charAt(0).toUpperCase() + p.id.slice(1)}` : 'Your own pod', () => ctx.onPod(i));
                    b.addEventListener('pointerenter', () => { hot.pod = i; ctx.onHover(i); });
                    b.addEventListener('pointerleave', () => { if (hot.pod === i) { hot.pod = null; ctx.onHover(null); } });
                    b.addEventListener('focus', () => { hot.pod = i; ctx.onHover(i); });
                    b.addEventListener('blur', () => { if (hot.pod === i) { hot.pod = null; ctx.onHover(null); } });
                    return b;
                }),
                skip: button('nsw-skip', 'Skip the wake-up', 'Skip the wake-up', () => ctx.onSkip()),
            };
            D.head = document.createElement('div'); D.head.className = 'nsw-head';
            D.name = document.createElement('b'); D.name.className = 'nsw-name';
            D.groggy = document.createElement('span'); D.groggy.className = 'nsw-groggy';
            D.head.append(D.name, D.groggy); D.panel.appendChild(D.head);
            D.panel.classList.add('sw'); D.aura.classList.add('sw');           // the voice keeps off them
            D.probe = document.createElement('span'); D.probe.setAttribute('aria-hidden', 'true'); layer.appendChild(D.probe);
            D.aura.addEventListener('pointerenter', () => { hot.aura = true; });
            D.aura.addEventListener('pointerleave', () => { hot.aura = false; });
            D.aura.addEventListener('focus', () => { hot.aura = true; });
            D.aura.addEventListener('blur', () => { hot.aura = false; });
            D.said = document.createElement('p'); D.said.className = 'nsw-sr'; D.said.setAttribute('aria-live', 'polite'); layer.appendChild(D.said);   // screen readers: the whole reading, once
        }
        const show = (e, on) => { e.classList.toggle('on', !!on); if (e.tagName === 'BUTTON') e.tabIndex = on ? 0 : -1; };
        const place = (e, x, y) => { const pos = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; if (e.style.transform !== pos) e.style.transform = pos; };
        const size = (e, w, h) => { const W = Math.round(w) + 'px', H = Math.round(h) + 'px'; if (e.style.width !== W) e.style.width = W; if (e.style.height !== H) e.style.height = H; };

        // ── measuring: the words' widths in frame px, at this pixel size (again when the fonts come in), in a hidden probe ──
        function width(cls, text) { D.probe.className = 'nsw-probe ' + cls; D.probe.textContent = text; return D.probe.offsetWidth; }
        function measure(u, name, reading) {
            const key = [u.toFixed(4), name, reading, window.NSTags ? window.NSTags.gen() : 0].join('|');
            if (measured && measured.key === key) return measured;
            const fp = px => Math.ceil((px + 0.6) / u - 0.02);
            const out = { key, name: fp(width('nsw-name', name)), groggy: fp(width('nsw-groggy', GROGGY)), read: fp(width('nsw-read', reading)),
                readH: width('nsw-read', 'Hg') && D.probe.offsetHeight, valve: Math.max(...VALVES.map(v => fp(width('nsw-valve', v.word)))), aura: fp(width('nsw-aura', D.aura.textContent)) };
            out.plate = TEXT_X + out.valve + 4;
            measured = out;
            return out;
        }

        // ── the layout (frame px) ──
        function layoutPanel(o, u) {
            const reading = o.reading.text + (o.reading.verdict ? ': ' + o.reading.verdict : '');
            const m = measure(u, o.name, reading), plates = 3 * m.plate + 2 * PLATE_GAP;
            const w = Math.max(plates, m.name + 6 + 14 + (o.groggy ? m.groggy + 4 : 0), m.read + 10) + PAD.x * 2;
            const h = PAD.top + HEAD_H + SCR_GAP + SCR_H + VAL_GAP + VAL_H + PAD.bottom;
            const pod = PODS[o.i], x = clamp(Math.round(pod.x - w / 2), EDGE, SW - w - EDGE), y = pod.top - THREAD - h;
            const sx = x + PAD.x, sy = y + PAD.top + HEAD_H + SCR_GAP, vy = sy + SCR_H + VAL_GAP, pw = Math.floor((w - PAD.x * 2 - 2 * PLATE_GAP) / 3);
            const valves = VALVES.map((v, k) => ({ key: v.key, x: sx + k * (pw + PLATE_GAP), y: vy, w: k === 2 ? w - PAD.x * 2 - 2 * (pw + PLATE_GAP) : pw, h: VAL_H }));
            const bx = clamp(pod.x, x + 3, x + w - 4);
            return { x, y, w, h, pod, screen: { x: sx, y: sy, w: w - PAD.x * 2, h: SCR_H }, valves, reading, thread: [[bx, y + h], [bx, y + h + 2], [pod.x, pod.top - 1]] };
        }
        function update(vm, t) {
            if (!D) return null;
            const u = ctx.unit(), L = { t, panel: null, aura: null, who: null, card: vm.card };
            // the card
            if (vm.card && vm.card.a > 0) { if (D.card.textContent !== vm.card.text) D.card.textContent = vm.card.text; D.card.style.opacity = String(vm.card.a); show(D.card, true); }
            else { D.card.style.opacity = ''; show(D.card, false); }
            show(D.skip, !!vm.skip);
            // the panel
            const o = vm.panel;
            if (o) {
                const P = L.panel = layoutPanel(o, u);
                P.o = o;
                D.panel.style.setProperty('--who', o.tone);
                if (D.name.textContent !== o.name) D.name.textContent = o.name;
                const gro = o.groggy ? GROGGY : '';
                if (D.groggy.textContent !== gro) D.groggy.textContent = gro;
                const [px, py] = ctx.css(P.x, P.y), m = measure(u, o.name, P.reading);
                place(D.panel, px, py); size(D.panel, P.w * u, P.h * u);
                D.panel.style.padding = `${Math.round(PAD.top * u)}px 0 0 ${Math.round(PAD.x * u)}px`;
                show(D.panel, true);
                typeOn(o, P, t);
                const [rx, ry] = ctx.css(P.screen.x + 4, P.screen.y + (SCR_H - m.readH / u) / 2);
                place(D.read, rx, ry); show(D.read, true);
                P.valves.forEach((v, k) => {
                    const b = D.valves[k], [vx, vy] = ctx.css(v.x, v.y), dis = !!(o.lock || o.auto);
                    place(b, vx, vy); size(b, v.w * u, v.h * u);
                    b.style.paddingLeft = Math.round(TEXT_X * u) + 'px';
                    if (b.disabled !== dis) b.disabled = dis;
                    b.classList.toggle('is-hot', !dis && hot.valve === v.key);
                    b.classList.toggle('is-dim', dis && o.down !== v.key);
                    show(b, true);
                });
            } else { show(D.panel, false); show(D.read, false); D.valves.forEach(b => show(b, false)); typed = { text: '', n: -1, at: 0 }; }
            // Let A.U.R.A. do it
            if (vm.aura && vm.aura.on) {
                const w = 4 + 9 + 4 + Math.ceil((width('nsw-aura', D.aura.textContent) + 0.6) / u) + 6, h = 15;
                L.aura = { x: AURA_AT.x, y: AURA_AT.y, w, h, hot: hot.aura, thread: [[AURA_AT.x + w, AURA_AT.y + 7], [INTERCOM.x + INTERCOM.w + 3, AURA_AT.y + 7], [INTERCOM.x + INTERCOM.w + 3, INTERCOM.y + INTERCOM.h - 4], [INTERCOM.x + INTERCOM.w, INTERCOM.y + INTERCOM.h - 4]] };
                const [ax, ay] = ctx.css(L.aura.x, L.aura.y);
                place(D.aura, ax, ay); size(D.aura, w * u, h * u); D.aura.style.paddingLeft = Math.round(17 * u) + 'px';
                D.aura.classList.toggle('is-hot', hot.aura);
                show(D.aura, true);
            } else { show(D.aura, false); hot.aura = false; }
            // the sleeping pods: buttons over them; the one pointed at named over its top
            PODS.forEach((p, i) => {
                const b = D.pods[i], on = !!(vm.pods && vm.pods[i]);
                if (on) { const [bx, by] = ctx.css(p.x - 18, p.top); place(b, bx, by); size(b, 36 * u, (PA.F - p.top) * u); }
                show(b, on);
            });
            L.invite = vm.invite && vm.pods ? vm.pods.map((on, i) => (on ? i : -1)).filter(i => i >= 0) : null;
            const hv = vm.hover != null && vm.pods && vm.pods[vm.hover] && !(o && o.i === vm.hover) ? vm.hover : null;
            if (hv != null) {
                const p = PODS[hv], nm = p.id.charAt(0).toUpperCase() + p.id.slice(1);
                if (D.who.textContent !== nm) D.who.textContent = nm;
                D.who.style.setProperty('--who', vm.tones ? vm.tones[p.id] : '#c9d1d6');
                const wpx = D.who.offsetWidth / u, [wx, wy] = ctx.css(p.x - wpx / 2, p.top - 11);
                place(D.who, wx, wy); show(D.who, true);
                L.who = { i: hv };
            } else show(D.who, false);
            last = L;
            return L;
        }
        /** The reading types on, letter by letter, its room kept (nothing moves), a block cursor at its end; the verdict
            ("too cold") turns warm once it is all there. Reduced motion: all at once. */
        function typeOn(o, P, t) {
            const text = P.reading, calm = still();
            if (o.alarm != null) {                                                       // the alarm: the screen says so, in red
                if (!typed.alarm) { D.read.innerHTML = `<em>${esc(WRONG)}</em>`; typed.alarm = true; announce(`${o.name}: ${WRONG}`); }
                return;
            }
            if (typed.alarm) { typed.alarm = false; typed.n = -1; }                      // back to the reading as it was
            if (typed.text !== text) typed = { text, n: -1, at: (o.readAt == null ? t : o.readAt) + TYPE_DELAY };
            const n = calm ? text.length : clamp(Math.floor((t - typed.at) / TYPE_MS), 0, text.length);
            if (n === typed.n) return;
            typed.n = n;
            if (n >= text.length) { D.read.innerHTML = esc(o.reading.text) + (o.reading.verdict ? ': <i>' + esc(o.reading.verdict) + '</i>' : ''); announce(`${o.name}: ${text}`); return; }
            D.read.innerHTML = `${esc(text.slice(0, n))}<span class="tg-k"></span><span class="tg-r">${esc(text.slice(n))}</span>`;
        }
        const typedAll = () => !!last && !!last.panel && typed.n >= typed.text.length;
        function announce(text) { if (D.said.textContent !== text) D.said.textContent = text; }

        // ── the pixel half: under the people (the pod pointed at), over them (the A.U.R.A. tag, the panel) ──
        function under(c, t) {
            const L = last;
            if (!L) return;
            if (L.invite) {                                                              // before the first pod is opened: the sleeping ones breathe
                const s = Math.floor(t / 125) % 16, k = still() ? 0.5 : (s < 8 ? s : 15 - s) / 7;
                L.invite.forEach(i => { if (L.who && L.who.i === i) return; const p = PODS[i]; if (k > 0.1) TA.brackets(c, p.x - 21, p.top - 3, 43, PA.F - p.top + 5, INVITE, k, false); });
            }
            if (L.who != null) { const p = PODS[L.who.i]; TA.brackets(c, p.x - 21, p.top - 3, 43, PA.F - p.top + 5, 'warm', 1, true); }
        }
        function over(c, t) {
            const L = last;
            if (!L) return;
            const calm = still();
            if (L.aura) {
                const a = L.aura;
                TA.thread(c, a.thread, 'cool', { solid: a.hot, lift: a.hot ? 1 : 0 });
                TA.shade(c, a.x, a.y, a.w, a.h, 1);
                TA.brackets(c, a.x, a.y, a.w, a.h, 'cool', 1, a.hot);
                TA.icon(c, 'ring', a.x + 4, a.y + 3, 'cool', a.hot ? 1 : 0);
            }
            const P = L.panel;
            if (!P) return;
            const o = P.o, k = calm ? 1 : clamp((t - (o.shownAt || 0)) / ARM_MS, 0, 1);
            const alarmOn = o.alarm != null && (calm || Math.floor(o.alarm / 125) % 2 === 0);
            const tone = alarmOn ? ALARM : COOL;
            TA.thread(c, P.thread, o.pulse ? o.pulse.hex : 'cool', { solid: !!o.pulse, frac: k });
            if (o.pulse) PA.pulse(c, P.thread, o.pulse.hex, o.pulse.k);
            TA.shade(c, P.x, P.y, P.w, P.h, Math.min(1, k * 1.6));
            TA.brackets(c, P.x, P.y, P.w, P.h, tone, k, alarmOn || !!hot.valve);
            if (k < 0.5) return;
            PA.pips(c, P.x + P.w - PAD.x - 13, P.y + PAD.top + 2, o.marks, o.next, t, calm);
            TA.panel(c, P.screen.x, P.screen.y, P.screen.w, P.screen.h, t);
            if (alarmOn) {                                                               // a red frame round the screen while it says so
                const s = P.screen; c.fillStyle = ALARM;
                c.fillRect(s.x - 2, s.y - 2, s.w + 4, 1); c.fillRect(s.x - 2, s.y + s.h + 1, s.w + 4, 1); c.fillRect(s.x - 2, s.y - 2, 1, s.h + 4); c.fillRect(s.x + s.w + 1, s.y - 2, 1, s.h + 4);
            }
            P.valves.forEach(v => {
                const dis = o.lock || o.auto, st = o.down === v.key ? 'down' : dis ? 'dim' : hot.valve === v.key ? 'hot' : 'idle';
                PA.valve(c, v.x, v.y, v.w, v.h, FLUID[v.key], st);
                PA.icon(c, v.key, v.x + ICON_X, v.y + Math.floor((v.h - 9) / 2) + (st === 'down' ? 1 : 0), FLUID[v.key], st === 'hot' ? 1 : st === 'dim' ? -1 : 0);
            });
        }
        function hide() {
            if (!D) return;
            [D.card, D.panel, D.read, D.aura, D.who, D.skip].concat(D.valves, D.pods).forEach(e => show(e, false));
            D.said.textContent = '';
            last = null; typed = { text: '', n: -1, at: 0 }; hot = { valve: null, aura: false, pod: null };
        }
        const rectOf = e => { if (!e || !e.classList.contains('on')) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
        function rects() {
            if (!D) return null;
            return { panel: rectOf(D.panel), read: rectOf(D.read), valves: Object.fromEntries(VALVES.map((v, k) => [v.key, rectOf(D.valves[k])])), aura: rectOf(D.aura), skip: rectOf(D.skip),
                pods: D.pods.map(rectOf), card: rectOf(D.card), typed: typedAll(), text: D.read.textContent };
        }
        return { init, update, under, over, hide, rects, typedAll, hot: () => Object.assign({}, hot) };
    }

    window.NSPodWords = Object.freeze({ create, VALVES });
})();
