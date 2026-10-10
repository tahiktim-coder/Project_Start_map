/* ═══ Silent Exodus · new screen (?new=1) · Voice.js: one spoken line at a time, beside whoever says it ═══════════════
   What it is: while the travel view is shown, a REAL log line that starts with "A.U.R.A.:", "Jaxon:", "Aris:", "Vance:" or
   "Mira:" becomes one voice line: the first name over the quote, beside that person in the tower (anchor 'person:<id>'),
   or beside our Lander outside (anchor 'ship') for A.U.R.A. and anyone out of frame. Under the words the picture darkens
   with the dither grain (canvas#ns-shade), never over a world or our Lander. Every other log line stays in the log,
   readable in orbit (docs/BUILD_A.md §6). One line at a time, a queue of three (the oldest dropped); hidden while a
   hover note is up; nothing while a card, a page or a minigame is up (a line waits then, and only shown, unblocked time
   ages it). A line logged while the view was hidden, in the moment before it shows (the story world revealed as we
   leave orbit, A.U.R.A.'s thanks after a card), is kept and said once the view is up.
   Source: the shade recipe of prototypes/slice/script/shade.js (v3's shadeSprite) and the voice of
   prototypes/screens/game-screen/reading.js (pin: the darkest of the anchor's places wins).
   Registers itself with NewScreen as 'voice'. Reads NSPaint. Writes nothing to the game.

   NewScreen.mods.voice: { init, resize, update, render, pointer,
     say({ id, who, text, anchor })   a line now: it cuts the line on screen; not logged
     sayLine(message)                 the same from a log-style line ('A.U.R.A.: "..."'); the caller logs it (a refusal)
     speaking() → 'aura' | id | null  who is talking now (the tower's speaker glows for A.U.R.A.)
     current() → { who, line } | null }
*/
(function () {
    'use strict';
    const NS = window.NewScreen, P = window.NSPaint;
    if (!NS || !NS.on || !P) return;

    const SPEAKERS = { 'A.U.R.A.': 'aura', Jaxon: 'jaxon', Aris: 'aris', Vance: 'vance', Mira: 'mira' };
    const LINE_RE = /^(A\.U\.R\.A\.|Jaxon|Aris|Vance|Mira):\s*(.+)$/;
    const QUEUE_MAX = 3, STALE_MS = 9000, HIDDEN_KEEP_MS = 2500, HIDDEN_MAX = 2, EDGE = 16, SHADE_PAD = 14, MOVE_RESAMPLE = 18, FALLBACK = { x: 0.72, y: 0.14 };
    const wordsIn = s => (String(s).trim().match(/\S+/g) || []).length;
    const readMs = line => Math.max(3200, wordsIn(line) * 300 + 1600);

    let cv = null, g = null, layer = null, queue = [], cur = null, noteUp = false, early = [];
    const sprites = new Map();

    /** "Jaxon: \"The drive's holding.\"" → { who: 'Jaxon', id: 'jaxon', line: "The drive's holding." } */
    function parse(message) {
        const m = LINE_RE.exec(String(message || '').trim());
        if (!m) return null;
        const line = m[2].trim().replace(/^["“]\s*/, '').replace(/\s*["”]$/, '').trim();
        return line ? { who: m[1], id: SPEAKERS[m[1]], line } : null;
    }
    function onLog(e) {
        const v = parse(e && e.detail && e.detail.message);
        if (!v) return;
        if (!NS.isShown()) {                                                             // kept a moment: the view may be about to show
            early = early.concat([Object.assign(v, { at: performance.now() })]).slice(-HIDDEN_MAX);
            return;
        }
        if ((cur && cur.line === v.line) || queue.some(q => q.line === v.line)) return;
        queue.push(Object.assign(v, { age: 0 }));
        while (queue.length > QUEUE_MAX) queue.shift();
    }
    /** show() was just called: the lines logged in the moment before it join the queue (older ones were orbit talk). */
    function onShowing() {
        const now = performance.now();
        early.filter(q => now - q.at < HIDDEN_KEEP_MS).forEach(q => {
            if (!queue.some(o => o.line === q.line)) queue.push({ who: q.who, id: q.id, line: q.line, age: 0 });
        });
        while (queue.length > QUEUE_MAX) queue.shift();
        early = [];
    }
    /** A log-style line said now (a refusal after a click): it cuts the line on screen. */
    function sayLine(message) {
        const v = parse(message);
        if (v) sayNow({ id: v.id, who: v.who, text: v.line });
    }
    /** A line said now, not through the log (a person clicked): it goes first and cuts the one on screen. */
    function sayNow(o) {
        if (!o || !o.text || !NS.isShown()) return;
        const who = o.who || (o.id === 'aura' ? 'A.U.R.A.' : String(o.id || '').replace(/^./, c => c.toUpperCase()));
        const id = SPEAKERS[who] || o.id || 'aura';
        queue = queue.filter(q => q.line !== o.text);
        queue.unshift({ who, id, line: String(o.text).replace(/^["“]\s*/, '').replace(/\s*["”]$/, ''), anchor: o.anchor || null, age: 0 });
        while (queue.length > QUEUE_MAX) queue.pop();
        end();
    }

    // ── where the words go: the anchor's places, kept inside the window; the darkest wins ──
    function anchorList(id, anchor) {
        const tries = (anchor ? [anchor] : []).concat(id === 'aura' ? ['ship'] : ['person:' + id, 'ship']);
        for (const n of tries) {
            const f = NS.anchors.get(n);
            if (!f) continue;
            let list = null;
            try { list = f(); } catch (err) { list = null; }
            if (list && list.length) return list.filter(Boolean);
        }
        return [{ x: innerWidth * FALLBACK.x, y: innerHeight * FALLBACK.y, side: 'below', align: 'center' }];
    }
    function boxAt(a, w, hgt) {
        let x = a.x, y = a.y;
        if (a.side === 'above') { y = a.y - hgt; if (a.align === 'center') x = a.x - w / 2; }
        else if (a.side === 'below') { if (a.align === 'center') x = a.x - w / 2; }
        else if (a.side === 'left') { x = a.x - w - 12; y = a.y - Math.min(hgt, 64) / 2; }
        else if (a.side === 'right') { x = a.x + 12; y = a.y - Math.min(hgt, 64) / 2; }
        else if (a.side === 'center') { x = a.x - w / 2; y = a.y - hgt / 2; }
        return { x: Math.round(Math.max(EDGE, Math.min(innerWidth - w - EDGE, x))), y: Math.round(Math.max(EDGE, Math.min(innerHeight - hgt - EDGE, y))), w, h: hgt };
    }
    /** Round things on screen now, in art px: worlds, our Lander. Travel offers them if it can. */
    function discs() {
        const t = NS.mods.travel;
        let list = [];
        try {
            if (t && typeof t.discs === 'function') list = (t.discs() || []).slice();
            const lp = t && typeof t.landerPose === 'function' ? t.landerPose() : null;
            if (lp && lp.len) list.push([lp.x, lp.y, lp.len * 0.6]);
        } catch (err) { list = []; }
        return list;
    }
    /** How busy the picture is under a CSS box: a world, our Lander, the hull edge, off screen. */
    function busy(r, ds) {
        const G = NS.G, f = G.dpr / G.k;
        let hits = 0, n = 0;
        const nx = Math.min(30, Math.ceil(r.w / 12)), ny = Math.min(10, Math.ceil(r.h / 10));
        for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
            const ax = (r.x + r.w * i / nx) * f, ay = (r.y + r.h * j / ny) * f; n++;
            if (ds.some(([cx, cy, rr]) => Math.hypot(ax - cx, ay - cy) < rr + 2)) hits++;
        }
        let v = hits / n;
        if (r.x * f < G.hull - 2 && (r.x + r.w) * f > G.hull + 2) v += 1;              // never one line across the hull edge
        if (r.x < 0 || r.y < 0 || r.x + r.w > innerWidth || r.y + r.h > innerHeight) v += 0.1;
        return v;
    }
    function place(c) {
        const boxes = anchorList(c.id, c.anchor).map(a => boxAt(a, c.w, c.h));
        if (!boxes.length) return;
        let pick = c.pick != null && c.pick < boxes.length ? c.pick : null;
        const b0 = boxes[pick == null ? 0 : pick];
        if (pick == null || !c.sampledAt || Math.hypot(c.sampledAt.x - b0.x, c.sampledAt.y - b0.y) > MOVE_RESAMPLE) {
            const ds = discs(), score = boxes.map(b => busy(b, ds));
            let best = 0;
            score.forEach((v, i) => { if (v < score[best] - 0.004) best = i; });
            if (pick == null || score[pick] > 0.06) pick = best;
            c.pick = pick;
            c.sampledAt = { x: boxes[pick].x, y: boxes[pick].y };
            c.strength = 0.62 + 0.3 * Math.min(1, score[pick] * 3);
        }
        const b = boxes[c.pick];
        if (!c.pos || c.pos.x !== b.x || c.pos.y !== b.y) { c.pos = { x: b.x, y: b.y }; c.el.style.transform = `translate(${b.x}px, ${b.y}px)`; }
    }

    // ── one line on screen ──
    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
    function start(v) {
        const box = el('div', 'ns-voice tone-' + v.id), who = el('p', 'ns-who');
        if (v.id === 'aura') who.append(el('span', 'ns-ring'));
        who.append(document.createTextNode(v.who));
        box.append(who, el('p', 'ns-say', v.line));
        layer.append(box);
        cur = { id: v.id, who: v.who, line: v.line, anchor: v.anchor || null, el: box, w: box.offsetWidth, h: box.offsetHeight, left: readMs(v.line), pick: null, pos: null, sampledAt: null, strength: 0.66 };
        place(cur);
        void box.offsetWidth;
        box.classList.add('is-in');
    }
    function end() { if (cur) { cur.el.remove(); cur = null; } }

    /** Is a hover note up on the space side? (Travel's words layer has something visible in it.) */
    function isNoteUp() {
        const t = NS.mods.travel;
        if (t && typeof t.noteUp === 'function') { try { return !!t.noteUp(); } catch (err) { return false; } }
        const words = document.getElementById('ns-world-words');
        if (!words || !words.children.length) return false;
        return [...words.children].some(c => !c.hidden && c.offsetParent !== null && parseFloat(getComputedStyle(c).opacity || '1') > 0.05);
    }

    // ── canvas#ns-shade: the ink dither under the words (v3's shadeSprite) ──
    function shadeSprite(w, hgt, ax, ay, strength) {
        const key = `${w}x${hgt}:${ax}:${ay}:${strength}`;
        let c = sprites.get(key);
        if (c) return c;
        const W2 = w + SHADE_PAD * 2, H2 = hgt + SHADE_PAD * 2, a0 = strength / 20, ink = P.hexRgb(P.INK), hw = w / 2, hh = hgt / 2, round = Math.min(hw, hh);
        c = document.createElement('canvas'); c.width = W2; c.height = H2;
        const sg = c.getContext('2d'), img = sg.createImageData(W2, H2);
        for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
            const qx = Math.abs(x + 0.5 - SHADE_PAD - hw) - (hw - round), qy = Math.abs(y + 0.5 - SHADE_PAD - hh) - (hh - round);
            const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round + (P.fbm(x / 7, y / 4, 17, 2) - 0.5) * 16;
            if (a0 * (1 - P.smooth(-12, SHADE_PAD, sd)) > P.threshold(x + ax, y + ay)) { const o = (y * W2 + x) * 4; img.data[o] = ink[0]; img.data[o + 1] = ink[1]; img.data[o + 2] = ink[2]; img.data[o + 3] = 255; }
        }
        sg.putImageData(img, 0, 0);
        if (sprites.size > 120) sprites.clear();
        sprites.set(key, c);
        return c;
    }
    function drawShade() {
        if (!cur || !cur.pos || noteUp) return;
        const G = NS.G, f = G.dpr / G.k, r = cur.pos;
        const x0 = Math.floor(r.x * f), y0 = Math.floor(r.y * f), w = Math.max(1, Math.ceil((r.x + cur.w) * f) - x0), hgt = Math.max(1, Math.ceil((r.y + cur.h) * f) - y0);
        const strength = Math.round(cur.strength * 20), sx = x0 - SHADE_PAD, sy = y0 - SHADE_PAD;
        if (strength > 0) g.drawImage(shadeSprite(w, hgt, sx & 7, sy & 7, strength), sx, sy);
        const ds = discs();                                                                // never shade over a world or our Lander
        if (!ds.length) return;
        g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
        ds.forEach(([x, y, rr]) => { g.beginPath(); g.arc(x, y, rr + 2, 0, Math.PI * 2); g.fill(); });
        g.restore();
    }

    const mod = {
        init() {
            cv = document.getElementById('ns-shade'); g = cv.getContext('2d'); layer = document.getElementById('ns-voice');
            addEventListener('log-updated', onLog);
            NS.bus.on('hidden', () => { end(); queue = []; });
            NS.bus.on('showing', onShowing);
        },
        resize(G) { NS.sizeCanvas(cv); if (cur) { cur.w = cur.el.offsetWidth; cur.h = cur.el.offsetHeight; cur.pick = null; cur.pos = null; } },
        update(dt) {
            if (NS.blocked()) { if (cur) cur.el.style.visibility = 'hidden'; return; }
            noteUp = isNoteUp();
            if (cur) {
                cur.left -= dt;
                if (cur.left <= 0) end();
            }
            queue.forEach(q => { q.age += dt; });                                         // only shown, unblocked time ages a waiting line
            if (!cur) {
                queue = queue.filter(q => q.age < STALE_MS);
                const next = queue.shift();
                if (next) start(next);
            }
            if (cur) { cur.el.style.visibility = noteUp ? 'hidden' : ''; place(cur); }
        },
        render() {
            if (!g) return;
            g.clearRect(0, 0, cv.width, cv.height);
            if (!NS.blocked()) drawShade();
        },
        pointer: () => false,
        current: () => (cur ? { who: cur.who, line: cur.line } : null),
        speaking: () => (cur && !noteUp && !NS.blocked() ? cur.id : null),
        say: sayNow,
        sayLine,
    };
    NS.register('voice', mod);
})();
