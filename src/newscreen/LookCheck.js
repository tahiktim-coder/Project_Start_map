/* ═══ Silent Exodus · new screen (?new=1) · LookCheck.js: the look floors, checked on the live page ════════════════════
   What it is: a test-only checker for the new look's floors (tokens.css): every word on screen is drawn in a face that is
   really loaded (no faux italic, no faux bold, no missing weight, no face outside the token sheet), reads at 14 px or
   more, reads at 4.5:1 or more against its ground, and no frame shows more than 40 words at once.
   The ground is a pure-ink estimate: the backgrounds of the text's own boxes laid over --ink. Words over painted art read
   lower than that; over art the capture decides (the harness measures the pixels).
   Loaded only with ?look=1 under the switch (index.html), never in play. It reads the page and changes nothing.
   It runs by itself when the page settles (and logs console.table rows only when the result changes); the capture
   harness calls run() before each shot and saves the report beside the picture.

   window.NSLookCheck (frozen)
     run({ log })            → { at, viewport, words, counts, faces[], small[], contrast[], frames[] }; log (default true)
                               prints each non-empty list with console.table
     last()                  → the last report
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const FLOOR_PX = 14, FLOOR_RATIO = 4.5, MAX_WORDS = 40, MIN_OPACITY = 0.02, SETTLE_MS = 800, MAX_WAIT_MS = 3000;
    const INK = [5, 7, 10];
    const HOUSE = ['ibm plex sans condensed', 'ibm plex sans', 'ibm plex mono', 'courier prime'];   // the faces of tokens.css
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE']);
    let lastReport = null, lastSig = '', timer = 0, waitingSince = 0;

    // ── colour and contrast ──
    function parseColor(s) {
        const m = /^rgba?\(([^)]+)\)$/.exec(String(s || '').trim());
        if (!m) return null;
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return p.length >= 3 && p.slice(0, 3).every(Number.isFinite) ? [p[0], p[1], p[2], p.length > 3 && Number.isFinite(p[3]) ? p[3] : 1] : null;
    }
    const over = (fg, bg, a) => [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

    /** The ground under an element: its boxes' background colours laid over --ink, outermost first; images count as ink. */
    function groundOf(el) {
        const chain = [];
        let image = false;
        for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
            const cs = getComputedStyle(e), bg = parseColor(cs.backgroundColor);
            if (cs.backgroundImage && cs.backgroundImage !== 'none') image = true;
            if (bg && bg[3] > 0) chain.push(bg);
            if (bg && bg[3] >= 1) break;
        }
        let g = INK.slice();
        for (let i = chain.length - 1; i >= 0; i--) g = over(chain[i], g, chain[i][3]);
        return { color: g, image };
    }
    function opacityOf(el) {
        let o = 1;
        for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= Number(getComputedStyle(e).opacity) || 0;
        return o;
    }

    // ── faces ──
    const famKey = s => String(s || '').replace(/["']/g, '').trim().toLowerCase();
    function weightRange(w) {
        const p = String(w).split(/\s+/).map(v => (v === 'normal' ? 400 : v === 'bold' ? 700 : Number(v)));
        return [p[0], p.length > 1 ? p[1] : p[0]];
    }
    /** What is wrong with the face this element is drawn in, or null. */
    function faceIssue(cs) {
        const first = famKey(cs.fontFamily.split(',')[0]);
        if (!HOUSE.includes(first)) return { issue: 'off-sheet', note: cs.fontFamily.split(',')[0].trim() };
        const list = [...document.fonts].filter(f => famKey(f.family) === first);
        if (!list.length) return { issue: 'not-requested', note: first };
        const italic = cs.fontStyle !== 'normal', w = Number(cs.fontWeight) || 400;
        const styled = list.filter(f => (f.style !== 'normal') === italic);
        if (!styled.length) return { issue: 'faux-italic', note: `${first} has no ${cs.fontStyle} face` };
        const exact = styled.filter(f => { const [a, b] = weightRange(f.weight); return w >= a && w <= b; });
        if (!exact.length) {
            const heaviest = Math.max(...styled.map(f => weightRange(f.weight)[1]));
            return w >= 600 && heaviest < 600 ? { issue: 'faux-bold', note: `${first} ${w}: heaviest face ${heaviest}` }
                : { issue: 'weight-missing', note: `${first} ${w} drawn in another weight` };
        }
        if (!exact.some(f => f.status === 'loaded')) return { issue: 'not-loaded', note: `${first} ${italic ? 'italic ' : ''}${w}: ${exact[0].status}` };
        return null;
    }

    // ── what is on screen ──
    const one = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map(c => '.' + c).join('');
    const selOf = el => (el.parentElement && el.parentElement !== document.body ? one(el.parentElement) + ' > ' : '') + one(el);
    /** The top layer an element belongs to: the body child that holds it (a card, a minigame, the view, a film…). */
    function frameOf(el) {
        let e = el;
        while (e.parentElement && e.parentElement !== document.body) e = e.parentElement;
        return one(e);
    }
    function visibleTexts() {
        const out = new Map(), vw = innerWidth, vh = innerHeight;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const words = n.nodeValue.trim();
            const el = n.parentElement;
            if (!words || !el || SKIP_TAGS.has(el.tagName)) continue;
            const range = document.createRange(); range.selectNodeContents(n);
            const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh);
            if (!rects.length) continue;
            if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true })) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility !== 'visible') continue;
            const opacity = opacityOf(el);
            if (opacity < MIN_OPACITY) continue;
            const prev = out.get(el);
            if (prev) { prev.text += ' ' + words; continue; }
            out.set(el, { el, cs, text: words, opacity, rect: rects[0] });
        }
        return [...out.values()];
    }
    const countWords = s => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

    function run(opts) {
        const log = !opts || opts.log !== false;
        const faces = [], small = [], contrast = [], frames = new Map();
        let words = 0;
        visibleTexts().forEach(t => {
            const { el, cs } = t, sel = selOf(el), text = t.text.slice(0, 60);
            const n = countWords(t.text);
            words += n;
            const fr = frameOf(el);
            frames.set(fr, (frames.get(fr) || 0) + n);
            const f = faceIssue(cs);
            if (f) faces.push({ sel, text, issue: f.issue, note: f.note, family: cs.fontFamily.split(',')[0].trim(), weight: cs.fontWeight, style: cs.fontStyle });
            // a transform's scale; offsetWidth is a whole px, so a width within 1 px of it is no scale (an inline chip at 14 px read 13.9)
            const box = el.getBoundingClientRect(), scale = el.offsetWidth > 0 && Math.abs(box.width - el.offsetWidth) > 1 ? box.width / el.offsetWidth : 1;
            const px = Math.round(parseFloat(cs.fontSize) * scale * 10) / 10;
            if (px < FLOOR_PX) small.push({ sel, text, px });
            const fg = parseColor(cs.color);
            if (fg) {
                const ground = groundOf(el), seen = over(fg, ground.color, fg[3] * t.opacity), r = Math.round(ratio(seen, ground.color) * 100) / 100;
                if (r < FLOOR_RATIO) contrast.push({ sel, text, ratio: r, color: hex(fg), alpha: Math.round(fg[3] * t.opacity * 100) / 100, ground: hex(ground.color) + (ground.image ? ' (+image)' : '') });
            }
        });
        const frameRows = [...frames].map(([frame, n]) => ({ frame, words: n, over: n > MAX_WORDS })).sort((a, b) => b.words - a.words);
        const report = {
            at: Math.round(performance.now()), viewport: `${innerWidth}x${innerHeight}`, words,
            counts: { faces: faces.length, small: small.length, contrast: contrast.length, framesOver: frameRows.filter(r => r.over).length },
            faces, small, contrast, frames: frameRows,
        };
        lastReport = report;
        if (log) {
            console.info(`[LookCheck] ${report.viewport}: ${words} words; faces ${faces.length}, under ${FLOOR_PX} px ${small.length}, under ${FLOOR_RATIO}:1 ${contrast.length}, frames over ${MAX_WORDS} words ${report.counts.framesOver}`);
            if (faces.length) console.table(faces);
            if (small.length) console.table(small);
            if (contrast.length) console.table(contrast);
            if (report.counts.framesOver) console.table(frameRows.filter(r => r.over));
        }
        return report;
    }

    // ── by itself: when the page settles, logged only when something changed ──
    function settled() {
        timer = 0; waitingSince = 0;
        try {
            const r = run({ log: false });
            const sig = JSON.stringify([r.counts, r.faces.map(f => f.sel + f.issue), r.small.map(s => s.sel), r.contrast.map(c => c.sel), r.frames.filter(f => f.over).map(f => f.frame)]);
            if (sig !== lastSig) { lastSig = sig; run({ log: true }); }
        } catch (err) { console.warn('[LookCheck] could not check the page', err); }
    }
    /** After SETTLE_MS of quiet; a page whose words never stop changing is still checked every MAX_WAIT_MS. */
    function soon() {
        const now = performance.now();
        if (!waitingSince) waitingSince = now;
        clearTimeout(timer);
        timer = setTimeout(settled, now - waitingSince > MAX_WAIT_MS ? 0 : SETTLE_MS);
    }
    function start() {
        new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, characterData: true });
        addEventListener('resize', soon);
        if (document.fonts) document.fonts.addEventListener('loadingdone', soon);
        soon();
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

    window.NSLookCheck = Object.freeze({ run, last: () => lastReport });
})();
