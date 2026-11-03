/* ═══ Silent Exodus · new screen (?new=1) · land/LandWords.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/landing-words.js (sha1 3b2b474bebc6, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   GAME: the portraits from the game's root; every line DRAFT; the orbit's tag and goHint are not in the game; the keycaps'
   words are here (KEY_WORDS: the sketch had them in index.html); the portraits are prepared once a page.
*/
/* ═══ Silent Exodus · prototypes · landing/landing-words.js: who speaks, their lines, and the dark under the words ════════
   What it is: the landing dummy's words, apart from the play (landing.js). The portraits (decoded once, kept small), the
   DRAFT lines (docs/STYLE.md: plain speech, one line at a time, with the speaker's portrait or A.U.R.A.'s ring), and the
   shade that darkens the picture under any words on it (reading.css's rule: no boxes behind words, a few soft steps
   toward the ink, never a screen door). NO SOUND.
   THE METEOR: the first landing's keycap words (index.html: "or the mouse, hold to pull up", "steer") are DRAFT too; "Too
   hot, Commander. Pull up." names the verb (only while you dive into heat); "Brace!" (a hard catch) is DRAFT.
   Round 3: "Get the light under us, Commander." / "Take us down through the gap, Commander." (A.U.R.A., the fall's start on
   the first landing, once) are DRAFT; Cora's "Deck coming up." is gone (Cora is the player: she never speaks, STYLE.md).
   window.LandingWords (frozen)
     WHO, NAME, HIM, FACE_SRC, faceURL     the speakers
     prepFaces()                           decode the portraits off the main thread, keep 160 px copies
     LINES                                 the lines: flare, hot, light, flat, hurt, result; tag (the orbit's label, not a voice)
     shadeUnder(ctx, els, FR, K, W, H)     darken the art canvas round the words, line by line (measured only when they change)
     shadeReset()                          measure again (a resize, the fonts arriving)
     frameStats                            the frame times for the headless checks: push, stats(phase), reset
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!P) return;
    const NAME = { jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira', cora: 'Cora', aura: 'A.U.R.A.' };
    const HIM = { jaxon: 'him', vance: 'him', aris: 'her', mira: 'her' };
    const WHO = { aura: { tone: 'aura', face: null }, cora: { tone: 'cora', face: 'F_1' }, jaxon: { tone: 'jaxon', face: 'M_2' }, aris: { tone: 'aris', face: 'F_3' }, vance: { tone: 'vance', face: 'M_4' }, mira: { tone: 'mira', face: 'F_5' } };
    const FACE_SRC = id => 'assets/crew/' + id + '.png';                  // GAME: from the game's root
    // the portraits are 1024 px files shown about 60 px tall: each is decoded off the main thread at the start and kept
    // as a small copy, so a line's first appearance never waits on a decode (from disk the copy is refused: the file is used)
    const FACE_PX = 160, faceURL = {};
    let prepped = false;                                                     // GAME: once a page (every landing asks)
    function prepFaces() {
        if (prepped) return;
        prepped = true;
        Object.values(WHO).forEach(w => {
            if (!w.face) return;
            const im = new Image(), id = w.face;
            im.src = FACE_SRC(id);
            const copy = () => {
                try {
                    const c = document.createElement('canvas'); c.width = FACE_PX; c.height = FACE_PX;
                    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
                    g.drawImage(im, 0, 0, FACE_PX, FACE_PX);
                    faceURL[id] = c.toDataURL('image/png');
                } catch (e) { /* the file itself is shown */ }
            };
            (im.decode ? im.decode() : new Promise((ok, no) => { im.onload = ok; im.onerror = no; })).then(copy, () => { /* the file itself is shown */ });
        });
    }
    const both = ids => NAME[ids[0]] + ' and ' + NAME[ids[1]];
    // DRAFT lines (brief §7) and the result's report (DRAFT too, beyond the brief's five: for the designer to approve or
    // rewrite), one at a time, with the portrait; otherwise silence. The orbit's tag is not a voice: a quiet label.
    // GAME: every line is DRAFT (none is approved for the game: the designer writes the lines); the orbit's tag and goHint
    // are not in the game. The words are the sketch's, kept exactly.
    const LINES = {
        waitDown: { who: 'aura', say: 'Readying the shuttle, Commander.' },       // DRAFT: the way down is still being painted
        flare: () => ({ who: 'aura', say: "Flare's down by the find, Commander." }),   // DRAFT
        hot: () => ({ who: 'aura', say: 'Too hot, Commander. Pull up.' }),        // DRAFT: only while you dive and the heat is about to bite
        aim: () => ({ who: 'aura', say: 'Get the light under us, Commander.' }),   // DRAFT: the goal, at the fall's start (once a run, a full drop)
        aimGap: () => ({ who: 'aura', say: 'Take us down through the gap, Commander.' }),   // DRAFT: the same when no light shows at the start (life by day, machines)
        aimFlare: () => ({ who: 'aura', say: 'Get the flare under us, Commander.' }),   // DRAFT: the same on a flare (one line, not the flare line and the aim line)
        brace: who => ({ who, say: 'Brace!' }),                                    // DRAFT: A.U.R.A. catches a fast shuttle hard
        save: () => ({ who: 'aura', say: "I've got us, Commander." }),             // DRAFT: the first landing of a run: she catches what would have been a crash
        light: who => ({ who, say: "There's the light." }),                         // DRAFT
        flat: side => ({ who: 'mira', say: 'Flat ground, ' + side + ' of you.' }),   // DRAFT: Mira aboard reads the ground (no light to aim at)
        hurt: (who, hurt) => { const hurtName = NAME[hurt], himOrHer = HIM[hurt]; return { who, say: `${hurtName}'s hurt. I've got ${himOrHer}.` }; },   // DRAFT: a crash, a team of two (GAME: the same words, written so the script export reads them whole)
        hurtAlone: who => ({ who, say: "I'm hurt. I can still walk." }),        // DRAFT (GAME, new): a crash, a team of one: the one who went down
        result: (grade, where, auraLanded, caught) => ({ who: 'aura', say: (caught ? 'Came in fast. I caught us, Commander.' : auraLanded ? 'I set us down, Commander.' : grade === 'soft' ? 'Down soft, Commander.' : 'Down hard, Commander.') + ' ' + ({ spot: 'Right on it.', walk: 'A short walk from here.', long: 'Long walk from here.' })[where] }),   // DRAFT (all of them)
    };
    // GAME: the keycaps' words (the sketch's index.html): hold and steer are DRAFT; aura is LanderGame's own button (LanderGame.js), not new
    const KEY_WORDS = { hold: 'or the mouse: hold to pull up', steer: 'steer', aura: 'Let A.U.R.A. land' };   // DRAFT (hold, steer)

    // ── the shade under words (reading.css: no boxes behind words). Each line of text darkens the picture round it with a
    // wide, soft, linear falloff in six fixed steps toward the ink, the Bayer grain between steps, capped low: on a bright
    // sky it reads as dusk round the words, never a panel. The line boxes are measured only when the words on screen
    // change; the mask is built then and laid on with one drawImage a frame (no read back of the picture, no layout). ──
    const PAD = 20, STEPS = 6, CAP = 0.56, INK = P.hexRgb(P.INK);
    const shade = { key: null, canvas: null };
    function lineRects(root) {
        const out = [], range = document.createRange(), tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!n.nodeValue.trim() || n.parentElement.closest('[hidden]')) continue; range.selectNodeContents(n); Array.from(range.getClientRects()).forEach(r => out.push(r)); }
        root.querySelectorAll('img, kbd').forEach(e => { if (!e.hidden && !e.closest('[hidden]')) out.push(e.getBoundingClientRect()); });
        return out;
    }
    function buildShade(rects, W, H) {
        const c = shade.canvas && shade.canvas.width === W && shade.canvas.height === H ? shade.canvas : document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d'), field = new Float32Array(W * H);
        rects.forEach(r => {
            for (let y = Math.max(0, r.y0 - PAD); y < Math.min(H, r.y1 + PAD); y++) for (let x = Math.max(0, r.x0 - PAD); x < Math.min(W, r.x1 + PAD); x++) {
                const dx = x < r.x0 ? r.x0 - x : x >= r.x1 ? x - r.x1 + 1 : 0, dy = y < r.y0 ? r.y0 - y : y >= r.y1 ? y - r.y1 + 1 : 0;
                const a = CAP * Math.max(0, 1 - Math.hypot(dx, dy * 1.4) / PAD);
                if (a > field[y * W + x]) field[y * W + x] = a;
            }
        });
        const img = g.createImageData(W, H), d = img.data;
        for (let i = 0; i < W * H; i++) {
            if (field[i] <= 0) continue;
            const x = i % W, y = (i / W) | 0, q = Math.min(1, Math.floor(field[i] * STEPS + P.threshold(x, y)) / STEPS);
            if (q <= 0) continue;
            d[i * 4] = INK[0]; d[i * 4 + 1] = INK[1]; d[i * 4 + 2] = INK[2]; d[i * 4 + 3] = Math.round(q * 255);
        }
        g.putImageData(img, 0, 0);
        shade.canvas = c;
    }
    /** els: the word elements on screen now (hidden ones skipped). W, H: the art canvas's size. */
    function shadeUnder(ctx, els, FR, K, W, H) {
        const shown = els.filter(el => el && !el.hidden && !el.closest('[hidden]'));
        const key = shown.map(el => el.id + ':' + el.style.left + ',' + el.style.top + ':' + el.textContent).join('|') + '|' + K + ':' + FR.left + ',' + FR.top;
        if (key !== shade.key) {
            shade.key = key;
            const rects = [];
            shown.forEach(el => lineRects(el).forEach(r => { if (r.width < 1 || r.height < 1) return; rects.push({ x0: Math.floor((r.left - FR.left) / K), y0: Math.floor((r.top - FR.top) / K), x1: Math.ceil((r.right - FR.left) / K), y1: Math.ceil((r.bottom - FR.top) / K) }); }));
            if (rects.length) buildShade(rects, W, H); else shade.canvas = null;
        }
        if (shade.canvas) ctx.drawImage(shade.canvas, 0, 0);
    }
    /** Forget the measured words (the layout changed: a resize, the fonts arriving). */
    function shadeReset() { shade.key = null; }

    // ── frame times (the headless checks): rAF gap, the work of the frame before it, its phase, what it did ──
    const ST = { gaps: [], work: [], phase: [], what: [] };
    const frameStats = Object.freeze({
        push(gap, work, phase, what) { ST.gaps.push(gap); ST.work.push(work); ST.phase.push(phase); ST.what.push(what); if (ST.gaps.length > 20000) Object.keys(ST).forEach(k => ST[k].splice(0, 5000)); },
        reset() { Object.keys(ST).forEach(k => { ST[k] = []; }); },
        stats(phaseOnly) {
            const idx = ST.gaps.map((g, i) => i).filter(i => !phaseOnly || ST.phase[i] === phaseOnly), gaps = idx.map(i => ST.gaps[i]).sort((a, b) => a - b), work = idx.map(i => ST.work[i]).sort((a, b) => a - b);
            const q = (a, p) => (a.length ? +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(1) : 0);
            const over = idx.filter(i => ST.gaps[i] > 33.4).map(i => ({ gap: +ST.gaps[i].toFixed(1), work: +ST.work[i].toFixed(1), phase: ST.phase[i], what: ST.what[i] }));
            return { n: gaps.length, gapP50: q(gaps, 0.5), gapP95: q(gaps, 0.95), gapMax: q(gaps, 1), workP50: q(work, 0.5), workP95: q(work, 0.95), workMax: q(work, 1), over: over.slice(0, 30), overCount: over.length };
        },
    });

    window.LandingWords = Object.freeze({ WHO, NAME, HIM, FACE_SRC, faceURL, prepFaces, LINES, KEY_WORDS, shadeUnder, shadeReset, frameStats });   // GAME: + KEY_WORDS
})();
