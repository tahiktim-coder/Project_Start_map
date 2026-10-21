/* ═══ Silent Exodus · new screen (?new=1) · stop/Tags.js: the words of the bridge's glass tags ════════════════════════════
   What it is: the DOM half of a glass tag (the pixel half, brackets, shade, icons and threads, is stop/TagArt.js): an
   element in #ns-stop-words whose box is a whole number of bridge pixels, so the brackets drawn in the bridge canvas sit
   exactly round it. Inside: the label in capitals (it types on, fast, when the tag first shows), and under it the chips
   (what it costs and gives, a chip icon each). Kinds: an action ('act'), the glass's title ('title': the world's name and
   what our scans read), the helm key ('key': Leave orbit, on Cora's console), a name over someone at the hatch ('who': first
   name in their colour and why they go), and the note over someone pointed at ('note').
   Text is set only when it changes; a tag is measured again only then (or when the bridge pixel changes size).
   Loaded only when the new-screen switch is on, after stop/TagArt.js and before stop/Stop.js.

   window.NSTags (frozen)
     make(layer, kind) → tag
       tag.el, tag.kind, tag.w, tag.h      the element; its size in bridge px (after size())
       tag.set({ label, chips: [{ icon, text, tone }], rows: [[chip]], name, why, line, loss, html, tone, cls }) → bool (changed)
                                                     a chip's tone 'kind' is the world's kind line (a quiet sentence)
       tag.size(unit, maxArt?) → [w, h]   bridge px, the content measured at unit CSS px per bridge px (cached)
       tag.place(cssX, cssY), tag.show(on), tag.flag(cls, on), tag.type(now, still)
     PAD                                   { kind: [left, top, right, bottom] } bridge px round the words
     gen() → n                             bumped when the web fonts come in (every size is measured again)
*/
(function () {
    'use strict';
    const T = window.NSTagArt;
    if (!window.NEW_SCREEN || !T) return;
    // room round the words, in bridge px: an action leaves 3 px, its 9 px icon and 4 px before the label
    const PAD = Object.freeze({ act: [16, 3, 7, 3], title: [5, 3, 7, 4], key: [15, 3, 6, 3], who: [3, 2, 3, 2], note: [6, 4, 7, 4] });
    const TYPE_MS = 26, TYPE_DELAY = 70;
    let fontGen = 0;                                                      // the web fonts came in: every tag measures itself again
    if (document.fonts) {
        const again = () => { fontGen++; };
        try { document.fonts.addEventListener('loadingdone', again); document.fonts.ready.then(again); } catch (err) { /* old browser: measured once */ }
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    function style() {
        if (document.getElementById('ns-tags-style')) return;
        const st = document.createElement('style');
        st.id = 'ns-tags-style';
        st.textContent = `#ns-stop-words { --fs-tag: calc(14px + 2px * var(--t, 1)); --fs-chip: calc(12px + 1px * var(--t, 1)); --fs-tname: calc(13px + 2px * var(--t, 1));
    --fs-why: calc(12px + 1px * var(--t, 1)); --fs-note: calc(14px + 2px * var(--t, 1)); --fs-kind: calc(14px + 1px * var(--t, 1)); --amber: #f0a050; --amber-br: #ffd8a0; --amber-dim: #a66a32; --cool: #a9b6bc; }
#ns-stop-words .tg-c.is-kind { font: 400 var(--fs-kind)/1.25 var(--f-text); letter-spacing: .01em; color: #c6cdd0; }
#ns-stop-words .tg-c.is-done { color: #7d8a90; }
#ns-stop-words .tg { position: absolute; left: 0; top: 0; box-sizing: border-box; margin: 0; opacity: 0; white-space: nowrap; pointer-events: none;
    transition: opacity 180ms steps(3, end); text-shadow: 0 1px 0 #05070a; }
#ns-stop-words .tg.on { opacity: 1; }
#ns-stop-words .tg-in { display: inline-grid; gap: calc(var(--bpx, 3px) * 1.4); justify-items: start; }
#ns-stop-words .tg-l { font: 600 var(--fs-tag)/1 var(--f-ui); letter-spacing: .16em; text-transform: uppercase; color: var(--amber); transition: color 120ms steps(2, end); }
#ns-stop-words .tg-l .tg-r { visibility: hidden; }
#ns-stop-words .tg-l .tg-k { display: inline-block; width: .5em; height: .9em; margin-right: -.5em; vertical-align: -.08em; background: currentColor; }
#ns-stop-words .tg.is-hot .tg-l { color: var(--amber-br); }
#ns-stop-words .tg.is-wait .tg-l { color: var(--amber-dim); }
#ns-stop-words .tg.is-cool .tg-l { color: var(--cool); }
#ns-stop-words .tg.is-cool.is-hot .tg-l { color: #e6ecee; }
#ns-stop-words .tg-cs { display: flex; flex-wrap: nowrap; gap: 2px calc(var(--bpx, 3px) * 3); font: 500 var(--fs-chip)/1.15 var(--f-ui); letter-spacing: .03em; color: var(--dim); transition: opacity 160ms steps(2, end); }
#ns-stop-words .tg.is-typing .tg-cs { opacity: 0; transition: none; }
#ns-stop-words .tg-c { display: inline-flex; align-items: center; gap: calc(var(--bpx, 3px) * 1.3); }
#ns-stop-words .tg-c i { flex: none; width: calc(var(--bpx, 3px) * 5); height: calc(var(--bpx, 3px) * 5); background: center / 100% 100% no-repeat; image-rendering: pixelated; }
#ns-stop-words .tg-c.is-gain { color: #ffc27a; }
#ns-stop-words .tg-c.is-risk { color: #e2a070; }
#ns-stop-words .tg-c.is-high { color: #ff7a6a; }
#ns-stop-words .tg-c.is-cool { color: var(--cool); }
#ns-stop-words .tg-c.is-who { color: var(--who, var(--ui)); font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
#ns-stop-words .tg-c.is-open { color: var(--amber-dim); font-style: italic; }
#ns-stop-words .tg.is-title .tg-l { font-weight: 500; letter-spacing: .14em; color: var(--ui); }
#ns-stop-words .tg-cs.is-rows { display: grid; gap: 3px; }
#ns-stop-words .tg-row { display: flex; gap: 2px calc(var(--bpx, 3px) * 4); }
#ns-stop-words .tg.is-title .tg-cs { color: #8f989c; font-weight: 400; }
#ns-stop-words .tg.is-key .tg-l { font-size: calc(13px + 1px * var(--t, 1)); color: #d89048; }
#ns-stop-words .tg.is-key.is-next .tg-l { color: var(--amber-br); }
#ns-stop-words .tg.is-key.is-hot .tg-l { color: #fff0d8; }
#ns-stop-words .tg.is-key.is-cool .tg-l { color: #a9b6bc; }
#ns-stop-words .tg.is-key.is-cool.is-hot .tg-l { color: #eef3f5; }
#ns-stop-words .tg.is-who .tg-in, #ns-stop-words .tg.is-note .tg-in { justify-items: center; text-align: center; gap: 2px; }
#ns-stop-words .tg.is-who .tg-n, #ns-stop-words .tg.is-note .tg-n { font: 600 var(--fs-tname)/1 var(--f-ui); letter-spacing: .16em; text-transform: uppercase; color: var(--who, var(--ui)); }
#ns-stop-words .tg.is-who .tg-why { max-width: var(--wrap, 12em); white-space: normal; font: 400 var(--fs-why)/1.2 var(--f-text); color: #d8d5cc; text-wrap: balance; }
#ns-stop-words .tg.is-state .tg-why { font-weight: 500; color: #ff7a6a; }
#ns-stop-words .tg.is-who .tg-n:empty { display: none; }
#ns-stop-words .tg.is-note .tg-in { justify-items: start; text-align: left; gap: 4px; }
#ns-stop-words .tg.is-note .tg-line { max-width: var(--wrap, 22em); white-space: normal; font: 400 var(--fs-note)/1.3 var(--f-text); color: #eceae2; }
#ns-stop-words .tg.is-note .tg-line b { font-weight: 600; color: var(--c, inherit); }
#ns-stop-words .tg.is-note .tg-loss { max-width: var(--wrap, 22em); white-space: normal; font: 400 calc(var(--fs-note) - 2px)/1.3 var(--f-text); color: var(--dim); }
#ns-stop-words .tg.is-note .tg-loss:empty { display: none; }
@media (prefers-reduced-motion: reduce) { #ns-stop-words .tg, #ns-stop-words .tg-l { transition: none; } }`;
        document.head.appendChild(st);
    }

    function chipsHtml(list) {
        return (list || []).map(c => {
            const tone = c.tone === 'gain' ? 'warm' : c.tone === 'cool' ? 'cool' : c.tone === 'who' ? c.color || 'warm' : c.tone === 'risk' || c.tone === 'high' ? 'warm' : 'cool';
            const icon = c.icon ? `<i style="background-image:url(${T.chipURL(c.icon, tone)})"></i>` : '';
            const style = c.color ? ` style="--who:${esc(c.color)}"` : '';
            return `<span class="tg-c${c.tone ? ' is-' + esc(c.tone) : ''}"${style}>${icon}${esc(c.text)}</span>`;
        }).join('');
    }
    function make(layer, kind) {
        style();
        const el = document.createElement('div'), inner = document.createElement('div');
        el.className = 'tg sw is-' + kind; inner.className = 'tg-in'; el.appendChild(inner); layer.appendChild(el);   // .sw.on: the voice keeps off it
        const pad = PAD[kind] || PAD.act;
        const tag = { el, kind, w: 0, h: 0, key: '', label: '', typedAt: -1e9, typed: -1, sized: null, pos: '', on: false, shownAt: -1e9 };
        let label = null, chips = null;
        tag.set = o => {
            const html = kind === 'who' ? `<b class="tg-n">${esc(o.name)}</b><span class="tg-why">${esc(o.why)}</span>`
                : kind === 'note' ? `${o.name ? `<b class="tg-n">${esc(o.name)}</b>` : ''}<span class="tg-line">${o.html || esc(o.line)}</span><span class="tg-loss">${esc(o.loss || '')}</span>`
                : `<b class="tg-l"></b>${o.rows && o.rows.length ? `<div class="tg-cs is-rows">${o.rows.map(r => `<div class="tg-row">${chipsHtml(r)}</div>`).join('')}</div>`
                    : o.chips && o.chips.length ? `<div class="tg-cs">${chipsHtml(o.chips)}</div>` : ''}`;
            const key = html + '|' + (o.label || '') + '|' + (o.wrap || '');
            if (o.tone) el.style.setProperty('--who', o.tone);
            if (key === tag.key) return false;
            tag.key = key; tag.sized = null;
            if (o.wrap) el.style.setProperty('--wrap', o.wrap); else el.style.removeProperty('--wrap');
            inner.innerHTML = html;
            label = inner.querySelector('.tg-l'); chips = inner.querySelector('.tg-cs');
            if (label) {
                const text = String(o.label || '').toUpperCase();
                if (text !== tag.label) { tag.label = text; tag.typedAt = -1e9; tag.typed = -1; }
                label.textContent = text;
                tag.typed = text.length;
            }
            return true;
        };
        tag.size = (unit, minArtH) => {
            const k = unit.toFixed(4) + ':' + (minArtH || 0) + ':' + fontGen;
            if (tag.sized === k) return [tag.w, tag.h];
            el.style.width = ''; el.style.height = ''; el.style.padding = '0';
            const w = inner.offsetWidth, h = inner.offsetHeight, lb = label && chips ? label.offsetTop + label.offsetHeight : 0;
            const slack = kind === 'who' || kind === 'note' ? 0.6 : 0;      // offsetWidth rounds: words that wrap get the part px back, or they wrap a word early
            tag.w = pad[0] + Math.ceil((w + slack) / unit - 0.02) + pad[2];
            tag.h = Math.max(minArtH || 0, pad[1] + Math.ceil(h / unit - 0.02) + pad[3]);
            tag.lh = lb ? Math.min(tag.h, pad[1] + Math.ceil(lb / unit) + 1) : 0;   // a key with chips: how far down its word's row reaches (art px)
            el.style.padding = `${pad[1] * unit}px ${pad[2] * unit}px 0 ${pad[0] * unit}px`;
            el.style.width = (tag.w * unit) + 'px'; el.style.height = (tag.h * unit) + 'px';
            tag.sized = k;
            return [tag.w, tag.h];
        };
        tag.place = (x, y) => { const pos = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; if (pos !== tag.pos) { el.style.transform = pos; tag.pos = pos; } };
        /** On (from `at`, a performance.now() time: a tag staggered after another waits its turn, unseen) or off at once. */
        tag.show = (on, at) => {
            if (!!on === tag.on) return;
            tag.on = !!on;
            if (on) { tag.shownAt = at == null ? performance.now() : at; tag.typedAt = tag.shownAt + TYPE_DELAY; tag.typed = -1; el.classList.add('is-typing'); }
            else el.classList.remove('on');
        };
        tag.flag = (cls, on) => { el.classList.toggle(cls, !!on); };
        /** Each frame: seen once its turn has come; the label types on (letters one by one, their room kept, so nothing moves,
            a block cursor at the end); the chips come after the label. */
        tag.type = (now, still) => {
            if (!tag.on) return;
            if (!el.classList.contains('on') && (still || now >= tag.shownAt)) el.classList.add('on');
            if (!label) { el.classList.remove('is-typing'); return; }
            const n = still ? tag.label.length : Math.max(0, Math.min(tag.label.length, Math.floor((now - tag.typedAt) / TYPE_MS)));
            if (n === tag.typed) return;
            tag.typed = n;
            if (n >= tag.label.length) { label.textContent = tag.label; el.classList.remove('is-typing'); return; }
            label.innerHTML = `${esc(tag.label.slice(0, n))}<span class="tg-k"></span><span class="tg-r">${esc(tag.label.slice(n))}</span>`;
        };
        return tag;
    }

    window.NSTags = Object.freeze({ make, PAD, style, gen: () => fontGen });
})();
