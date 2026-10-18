/* ═══ Silent Exodus · new screen (?new=1) · stop/Words.js: what the bridge's glass shows, and where ══════════════════════
   What it is: the words of a stop, laid out on the bridge as parts of the ship (the window is the ship's display):
   - the glass's title, top left: the world's name in capitals and, as quiet chips, what our scans read of it (Scan.js);
   - each action as a glass tag (amber corner brackets, a dither shade, a pixel icon, the label in capitals, its cost and
     gain as chips) beside what it acts on, with a thin dotted thread to an anchor ON the target: Scan to the world's limb,
     Dock to the station's port, Mine to the biggest rock, Refuel to the cloud tops, Fly closer and Settle here to the
     landing site, Answer the call to the blink in the sky, Date the wreck to Mira's screen, Go into the light to the light;
   - the team's "GO DOWN" tag over the hatch (the two names, the risk), and over each of the two at the hatch their first
     name in their colour and why they go;
   - "Leave orbit" as a lit key on Cora's console (it glows as the next step once nothing but settling is left);
   - the note over someone pointed at: at the hatch what they are good for; at the window "Aris goes instead of Vance" and
     what the ship loses while they are down; too weak, why;
   - the ship's stock on the wall left of the window (NSStock).
   A tag draws in from its corners, its label types on, its thread reaches out (80 ms apart, 125 ms steps); pointed at, it
   brightens, its thread turns solid with a pulse at the anchor, and the glass shows what it does (stop/TagArt.js).
   At most 40 words on screen (the voice line counted): the names and the labels first, then the team's chips, the names
   at the hatch, the world's name, the actions' chips, the scan chips. Hidden chips keep their room: nothing moves under
   the pointer. Words never sit over the world's disc or a person. Settle here is cool grey, never warm.
   The first time an action shows, A.U.R.A. says once what it does (NSOrbit.TELL), one at a time, the pointed-at first.
   Loaded only when the new-screen switch is on, after stop/TagArt.js and stop/Tags.js, before stop/Stop.js.

   window.NSStopWords (frozen)
     create(ctx) → words     ctx from Stop.js: { S, css, unit, t0, poseOf, picking, team, arrived, joinedLast, isWrongPlace,
                             proposed, sprite(id), NAMES, TONE, CREW, OFFX, F, HATCH, NAV, HELM } (frame px)
     words.init(layer)       the tags and the stock in #ns-stop-words
     words.layout(t) → L     what shows where now (frame px), or null before the world has braked in
     words.glass(c, t, L)    what a pointed-at tag shows on the glass (drawn under the room's frame)
     words.threads(c, t, L)  the threads and their pins (under the people)
     words.tags(c, t, L)     shades, brackets, icons, the helm key (over everything)
     words.apply(t, L)       the DOM half: place, show, type on; A.U.R.A.'s first-time lines
     words.hide()            all off;  words.hit(cx, cy) → { kind: 'act' | 'leave' | 'who', key?, id? } | null (CSS px)
     words.fresh(key) → bool shown less than 400 ms ago (a click is ignored);  words.noteUp(), words.skyY() (frame y)
     words.debug() → [{ text, rect }]
*/
(function () {
    'use strict';
    const NS = window.NewScreen, GL = window.NSGlass, TA = window.NSTagArt, TG = window.NSTags;
    if (!NS || !NS.on || !GL || !TA || !TG) return;
    const WIN = GL.WIN, LIGHT = GL.LIGHT, SW = GL.SW;
    const MAX_LIT = 4, MAX_WORDS = 40, GUARD_MS = 400, TELL_AFTER_MS = 1500, STAGGER = 80, ARM_MS = 170, THREAD_MS = 280, GAP = 5;
    const WORTH = ['light', 'escape', 'accept', 'call', 'strange', 'date', 'team', 'dock', 'mine', 'settle', 'scan', 'skim'];   // more than 4: these first
    const NEAR_WORLD = ['world', 'station', 'field', 'giant', 'site', 'light'];
    const ICON = { scan: 'scan', team: 'shuttle', dock: 'clamp', mine: 'pick', skim: 'drop', strange: 'ring', call: 'wave', date: 'disc', settle: 'flag', light: 'light', escape: 'escape', accept: 'accept' };
    const GOOD = {                                                        // pointing at someone at the hatch: what they do down there, and aboard
        jaxon: 'Down there I fly the lander. Up here, the drive is mine.',
        aris: 'Down there I bring the hurt back walking. Up here, the med bay.',
        vance: 'Down there I take the hit for the other one. Up here, I keep people safe.',
        mira: 'Down there I bring their star fix back. Up here, I scan the site.',
    };
    const WEAK_LINE = "I went without supper. I'm too weak to go down this time.";   // too weak for this trip (GameState.serveSupper)
    const DESK = [334, 429], KEY_Y = 290;                                 // Cora's console front (frame px): the helm key sits on it
    const ROOM_R = 606;                                                   // frame px: the inside of the bridge's right wall (a note never runs onto the hull)
    const WHO_WRAP = 44;                                                  // frame px: the most a name over someone at the hatch may spread
    const WHO_GAP = 3;                                                    // frame px: kept between the two names at the hatch
    const HATCH_NOTE_WRAP = 78;                                           // frame px: the note over someone at the hatch, narrow (it sits under GO DOWN)
    const wordsIn = s => (String(s || '').trim().match(/\S+/g) || []).length;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const clamp01 = v => clamp(v, 0, 1);
    const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const titleCase = s => (s && s === s.toUpperCase() && /[A-Z]/.test(s) ? s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : s);
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const still = () => !!(mq && mq.matches);
    const overlaps = (a, b, pad) => a[0] < b[0] + b[2] + pad && a[0] + a[2] + pad > b[0] && a[1] < b[1] + b[3] + pad && a[1] + a[3] + pad > b[1];
    function onDisc(b, dc, pad) { if (!dc) return false; const qx = clamp(dc[0], b[0], b[0] + b[2]), qy = clamp(dc[1], b[1], b[1] + b[3]); return Math.hypot(qx - dc[0], qy - dc[1]) < dc[2] + pad; }
    /** The two names at the hatch keep a small gap between them: each steps half the shortfall away from the other. */
    function spread(boxes) {
        if (boxes.length < 2) return boxes;
        const [a, b] = boxes.slice().sort((p, q) => p.x - q.x);
        const short = a.x + a.w + WHO_GAP - b.x;
        if (short <= 0) return boxes;
        const ax = Math.max(2, a.x - Math.ceil(short / 2)), bx = Math.min(SW - b.w - 2, ax + a.w + WHO_GAP);
        return boxes.map(o => (o === a ? Object.assign({}, o, { x: ax }) : o === b ? Object.assign({}, o, { x: bx }) : o));
    }

    function create(ctx) {
        const S = ctx.S;
        let T = null, stock = null, telling = false, layer = null;
        const drawnAt = new Map();      // a tag's key → the clock when it came on (its draw-in), staggered
        const shownWall = new Map();    // a tag's key → performance.now() when it came on (clicks wait GUARD_MS; A.U.R.A. TELL_AFTER_MS)
        const heads = new Map();        // id → the first painted row of their standing sprite
        let riskKey = '', riskVal = null, lastL = null;

        function init(el) {
            layer = el;
            T = { title: TG.make(layer, 'title'), acts: [0, 1, 2, 3].map(() => TG.make(layer, 'act')), go: TG.make(layer, 'act'), key: TG.make(layer, 'key'),
                who: [TG.make(layer, 'who'), TG.make(layer, 'who')], note: TG.make(layer, 'note'), probe: TG.make(layer, 'note') };
            T.key.set({ label: 'Leave orbit' });
            stock = window.NSStock ? window.NSStock.board(layer) : null;
        }
        const allTags = () => [T.title, T.go, T.key, T.note].concat(T.acts, T.who);

        // ── geometry ──
        /** The top of someone's head standing at floor row F (frame px): their idle sprite's first painted row. */
        function headTop(id) {
            if (!heads.has(id)) {
                let row = 0;
                try {
                    const Sp = ctx.sprite(id), d = Sp.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, Sp.w, Sp.h).data;
                    outer: for (let y = 0; y < Sp.h; y++) for (let x = 0; x < Sp.w; x++) if (d[(y * Sp.w + x) * 4 + 3]) { row = y; break outer; }
                    heads.set(id, { row, oy: Sp.origin.y });
                } catch (err) { heads.set(id, { row: 4, oy: 101 }); }
            }
            const h = heads.get(id);
            return ctx.F - h.oy + h.row;
        }
        /** A point just inside the world's limb, facing the box: level with it when the world is beside it, else the nearest
            point of the rim (a giant pushed in from below). Kept inside the glass. */
        function limb(dc, box) {
            const midY = box[1] + box[3] / 2, cx = box[0] + box[2] / 2;
            let p;
            if (box[0] + box[2] < dc[0] - dc[2] * 0.5 && Math.abs(midY - dc[1]) < dc[2] * 0.82) {
                const dy = midY - dc[1];
                p = [dc[0] - Math.sqrt(Math.max(0, dc[2] * dc[2] - dy * dy)) + 3, midY];
            } else {
                const dx = cx - dc[0], dy = midY - dc[1], d = Math.hypot(dx, dy) || 1;
                p = [dc[0] + dx / d * (dc[2] - 3), dc[1] + dy / d * (dc[2] - 3)];
            }
            return [Math.round(clamp(p[0], WIN.x0 + 3, WIN.x1 - 4)), Math.round(clamp(p[1], WIN.y0 + 3, WIN.y1 - 4))];
        }
        /** Where the world's painted picture starts on the left between rows y0 and y1 (frame px): its moon, ring or debris
            included (they sit beside the world). Measured once per picture from its pixels; null when there is none. */
        const lefts = new WeakMap();
        function pictureLeft(g, y0, y1) {
            const p = g && g.p;
            if (!p || p.fixed || p.none || !p.canvas || p.jobs && p.jobs.length) return null;
            let rows = lefts.get(p);
            if (!rows) {
                try {
                    const c = p.canvas, d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
                    rows = new Int16Array(c.height).fill(-1);
                    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
                        const o = (y * c.width + x) * 4;                  // what can be seen: near-black dither on the black sky does not count
                        if (d[o + 3] && 0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2] > 30) { rows[y] = x; break; }
                    }
                } catch (err) { rows = new Int16Array(0); }
                lefts.set(p, rows);
            }
            const top = Math.round(g.y) - p.half, left = Math.round(g.x) - p.half;
            let min = Infinity;
            for (let y = Math.max(0, Math.floor(y0 - top)); y <= Math.min(rows.length - 1, Math.ceil(y1 - top)); y++) if (rows[y] >= 0) min = Math.min(min, rows[y]);
            return min === Infinity ? null : left + min;
        }
        /** The anchor ON the target of each action (frame px). */
        function anchorOf(a, g, dc, site, box) {
            switch (a.key) {
                case 'escape': case 'accept': return null;                // the Wrong Place's two choices are about the place itself
                case 'scan': return limb(dc, box);
                case 'strange': return [Math.round(dc[0] - dc[2] * 0.92), Math.round(dc[1] + dc[2] * 0.62)];   // the strange site is in space, off the world's lower limb (marked there)
                case 'dock': return [Math.round(g.x), Math.round(g.y + g.r * 11 / 24)];          // the station's core, its lower end: the port
                case 'mine': return [Math.round(g.x - g.r * 0.34 + 2), Math.round(g.y)];          // the biggest rock's near side
                case 'light': return LIGHT.slice();
                case 'call': return GL.callAt();
                case 'date': return a.near === 'mira' ? [ctx.NAV + 45, ctx.F - 67] : [584, 122];   // Mira's chart screen, or A.U.R.A.'s grille
                case 'team': return [ctx.HATCH, ctx.F - 47];                                      // the grab bar over the hatch
                default: return site.map(Math.round);                                             // the landing site
            }
        }
        /** From the side of a box that faces its anchor: a short stub out, then straight to it. */
        function threadTo(b, an) {
            const [x, y, w, h] = b, my = Math.round(y + h / 2);
            if (an[0] >= x + w + 4) return [[x + w, my], [x + w + 3, my], an];
            if (an[0] <= x - 4) return [[x - 1, my], [x - 4, my], an];
            const bx = clamp(an[0], x + 2, x + w - 3);
            return an[1] > y + h ? [[bx, y + h], [bx, y + h + 2], an] : [[bx, y - 1], [bx, y - 3], an];
        }

        // ── what each tag says ──
        function teamRisk(ids) {
            const k = ids.join('+') + '@' + S.readAt;
            if (k !== riskKey) { riskKey = k; try { riskVal = NS.flow && NS.flow.teamRisk ? NS.flow.teamRisk(ids) : null; } catch (err) { riskVal = null; } }
            return riskVal;
        }
        function teamChips() {
            const ids = ctx.team(), out = ids.map(id => ({ text: ctx.NAMES[id], tone: 'who', color: ctx.TONE[id] }));
            if (ids.length < 2) out.push({ icon: 'slot', text: ids.length ? 'one more' : 'two more', tone: 'open' });
            else { const r = teamRisk(ids); if (r != null) out.push({ icon: 'risk', text: `risk ${r}%`, tone: r >= 30 ? 'high' : 'risk' }); }
            return out;
        }
        const chipWords = list => (list || []).reduce((n, c) => n + wordsIn(c.text), 0);
        function factRows() {
            let f = null;
            try { f = NS.flow && typeof NS.flow.facts === 'function' && S.id ? NS.flow.facts(S.id) : null; } catch (err) { console.error('NewScreen stop: the scan facts failed', err); }
            if (!f) return [];
            const dTone = { 'rough ground': 'risk', 'dangerous ground': 'high' }[f.danger] || null;
            const rows = [[f.site && { icon: 'site', text: cap(f.site) }, f.gives && { icon: 'gives', text: cap(f.gives) }],
                [f.danger && { icon: 'danger', text: cap(f.danger), tone: dTone }, f.live && { icon: 'live', text: cap(f.live) }]];
            return rows.map(r => r.filter(Boolean)).filter(r => r.length);
        }
        /** The note over someone pointed at (null: nobody fit to go or too weak is pointed at). */
        function noteFor(id) {
            if (!id) return null;
            const tone = ctx.TONE[id], name = ctx.NAMES[id];
            if (S.aside.includes(id)) return { name, line: WEAK_LINE, loss: '', tone };
            if (!GOOD[id] || !S.lineup.includes(id)) return null;
            const team = ctx.team();
            if (team.includes(id)) return { name, line: GOOD[id], loss: '', tone };
            const out = team.length >= 2 ? ctx.joinedLast() : null, mates = team.filter(q => q !== out);
            let loss = '';
            try { loss = (NS.flow && typeof NS.flow.lossOf === 'function' ? NS.flow.lossOf(id, mates) : '') || ''; } catch (err) { console.error('NewScreen stop: the loss failed', err); }
            const b = q => `<b style="--c:${ctx.TONE[q]}">${ctx.NAMES[q]}</b>`;
            const html = S.lineup.length <= 2 ? `${b(id)} goes down` : out ? `${b(id)} goes instead of ${b(out)}` : team.length ? `${b(id)} goes with ${b(team[0])}` : `${b(id)} goes down`;
            const text = html.replace(/<[^>]+>/g, '');
            return { html, text, loss: loss ? cap(loss) + '.' : `Nothing aboard needs ${id === 'aris' || id === 'mira' ? 'her' : 'him'} this time.`, tone };
        }

        // ── the words budget: at most 40 on screen (the voice line counted, unless a note has stepped it back). The labels, the
        //    key and the stock always; then, while they fit: the team's chips, the names at the hatch (both or neither), the
        //    world's name, each action's chips, the scan chips. Decided afresh only while nothing is pointed at: what is on
        //    screen holds still under the pointer ──
        let frozen = null;
        function decide(o) {
            if ((S.hot || S.hover) && frozen) return frozen;
            const voice = !o.note && NS.mods.voice && NS.mods.voice.current ? NS.mods.voice.current() : null;
            let budget = MAX_WORDS - (voice ? wordsIn(voice.who) + wordsIn(voice.line) : 0);
            const take = n => { if (n <= 0) return true; if (budget - n >= 0) { budget -= n; return true; } return false; };
            o.acts.forEach(a => { budget -= wordsIn(a.words); });
            if (o.team) budget -= 2;
            if (o.leave) budget -= 2;
            if (o.stock) budget -= window.NSStock.KEYS.length;
            if (o.note) budget -= wordsIn(o.note.name) + wordsIn(o.note.text || o.note.line) + wordsIn(o.note.loss);
            const dec = { act: {} };
            dec.who = !!o.team && take(o.whoIds.reduce((n, id) => n + 1 + wordsIn(S.pick.why[id] || ''), 0));
            const named = dec.who ? o.goChips.filter(c => c.tone === 'who' && o.whoIds.some(id => ctx.NAMES[id] === c.text)).length : 0;   // read once: the same names stand over their heads
            dec.go = !!o.team && take(chipWords(o.goChips) - named);
            dec.title = !!o.name && take(wordsIn(o.name));
            o.acts.forEach(a => { dec.act[a.key] = take(chipWords(a.chips)); });
            dec.facts = dec.title && o.rows.length > 0 && take(o.rows.reduce((n, r) => n + chipWords(r), 0));
            frozen = dec;
            return dec;
        }
        /** How tall the note over someone at the hatch would be (GO DOWN leaves room for it under itself). */
        const noteHs = new Map();
        function hatchNoteH(id, u) {
            const k = `${id}:${u.toFixed(3)}:${TG.gen()}`;
            if (!noteHs.has(k)) { T.probe.set({ name: ctx.NAMES[id], line: GOOD[id], loss: '', wrap: Math.floor(HATCH_NOTE_WRAP * u) + 'px' }); noteHs.set(k, T.probe.size(u)[1]); }
            return noteHs.get(k);
        }

        // ── the layout: what shows where, frame px ──
        function layout(t) {
            if (!T || !S.id || !GL.settled(t, S.shownAt)) return null;
            const u = ctx.unit(), busy = !!S.send, wrong = ctx.isWrongPlace(), picking = ctx.picking();
            const g = GL.geom(t, S.shownAt), dc = GL.disc(t, S.shownAt) || [g.x, g.y, g.r], site = GL.site(t, S.shownAt);
            const rank = a => { const i = WORTH.indexOf(a.key); return i < 0 ? WORTH.length : i; };
            const best = S.actions.slice().sort((a, b) => rank(a) - rank(b)).slice(0, MAX_LIT);
            const shown = busy ? [] : S.actions.filter(a => best.includes(a));
            const teamAct = shown.find(a => a.team && picking && ctx.proposed()) || null, acts = shown.filter(a => !a.team);
            // each action keeps its own tag while it stays on screen (a neighbour going never makes it draw in again)
            const used = new Set(), tagOf = new Map();
            acts.forEach(a => { const tg = T.acts.find(q => q.key0 === a.key); if (tg) { used.add(tg); tagOf.set(a.key, tg); } });
            acts.forEach(a => { if (tagOf.has(a.key)) return; const tg = T.acts.find(q => !used.has(q)); used.add(tg); tagOf.set(a.key, tg); });
            const L = { t, items: [], preview: null, stock: !NS.blocked() && !!stock };
            const leaveOn = !busy && !wrong, note = noteFor(S.hover), team = teamAct ? ctx.team() : [];
            const goChips = teamAct ? teamChips() : [], whoIds = team.filter(ctx.arrived);
            const nameText = S.node ? titleCase(S.node.name || '') : '', rows = nameText ? factRows() : [];
            const dec = decide({ acts, team: !!teamAct, leave: leaveOn, stock: L.stock, note, goChips, whoIds, name: nameText, rows });

            // the glass's title: the world's name, and what our scans read of it
            let titleBox = null;
            if (dec.title) {
                T.title.set({ label: nameText, rows: dec.facts ? rows : null });
                const [w, h] = T.title.size(u);
                titleBox = [WIN.x0 + 6, WIN.y0 + 5, w, h];
                L.items.push({ key: 'title', tag: T.title, kind: 'title', x: titleBox[0], y: titleBox[1], w, h, tone: 'cool', brackets: true });
            }
            // the actions beside what they act on
            const boxes = [];
            const add = (a, x, y, w, h) => {
                const item = { key: a.key, tag: tagOf.get(a.key), kind: 'act', x, y, w, h, tone: a.key === 'settle' ? 'cool' : 'warm', icon: ICON[a.key], brackets: true };
                item.anchor = anchorOf(a, g, dc, site, [x, y, w, h]);
                item.thread = item.anchor ? threadTo([x, y, w, h], item.anchor) : null;
                L.items.push(item); boxes.push([x, y, w, h]);
            };
            const sized = acts.map(a => { const tg = tagOf.get(a.key); tg.set({ label: a.words, chips: dec.act[a.key] ? a.chips : null }); return tg.size(u); });
            const stack = acts.filter(a => NEAR_WORLD.includes(a.near) || a.near === 'call' || (a.near === 'under' && !wrong))   // the call too: last, its thread runs down to the blink
                .sort((a, b) => (a.near === 'call') - (b.near === 'call'));
            if (stack.length) {
                let right = g.kind === 'giant' ? Math.round(site[0] + 76) : Math.round(dc[0] - dc[2] - 14), top = g.kind === 'giant' ? Math.round(site[1] - 84) : Math.round(site[1] - 16);   // a giant: in the sky over the cloud tops
                if (g.kind === 'station') top = Math.round(g.y + g.r * 11 / 24 - sized[acts.indexOf(stack[0])][1] / 2);   // level with the port: the thread runs under the panels
                right = Math.max(WIN.x0 + 72, right);
                const list = stack.map(a => { const [w, h] = sized[acts.indexOf(a)]; return [a, w, h]; });
                const total = list.reduce((n, q) => n + q[2] + GAP, -GAP), floor = WIN.y1 - 32;
                if (top + total > floor) top = floor - total;
                if (g.kind === 'world') {                                 // a moon, a ring or debris on the world's left: the stack keeps clear of it too
                    const edge = pictureLeft(g, top - 4, top + total + 4);
                    if (edge != null) right = Math.max(WIN.x0 + 72, Math.min(right, edge - 10));
                }
                if (titleBox && top < titleBox[1] + titleBox[3] + 8 && right - Math.max(...list.map(q => q[1])) < titleBox[0] + titleBox[2] + 4) top = titleBox[1] + titleBox[3] + 8;
                list.forEach(([a, w, h]) => {
                    let x = right - w;
                    while (onDisc([x, top, w, h], dc, 4) && x > WIN.x0 + 4) x -= 2;
                    add(a, x, top, w, h); top += h + GAP;
                });
            }
            acts.filter(a => !stack.includes(a)).forEach(a => {
                const [w, h] = sized[acts.indexOf(a)];
                let x, y;
                if (a.near === 'mira') {
                    const p = ctx.poseOf('mira', t), mx = p && !p.hidden ? Math.round(p.x) + ctx.OFFX : ctx.NAV;
                    x = mx + 8; y = headTop('mira') - h - 3;              // over her shoulder, clear of her head; its thread drops to her screen
                } else if (a.near === 'under') {                          // the Wrong Place's two choices: a row low in the open sky
                    const row = boxes.filter(b => b[1] > WIN.y1 - 60);
                    x = row.length ? Math.max(...row.map(b => b[0] + b[2])) + 10 : WIN.x0 + 12; y = WIN.y1 - 30 - h;
                } else { x = WIN.x1 - 6 - w; y = WIN.y0 + 5; }           // A.U.R.A.'s, and anything else: the glass's top right
                for (let k = 0; k < 12 && boxes.some(b => overlaps([x, y, w, h], b, 3)); k++) y += 6;   // never on another tag
                if (a.near !== 'mira') y = Math.min(y, WIN.y1 - 22 - h);  // and never down among the heads at the window
                while (onDisc([x, y, w, h], dc, 4) && x < WIN.x1 - w - 4 && a.near === 'mira') x += 2;
                add(a, clamp(x, 4, SW - w - 4), y, w, h);
            });

            // the team at the hatch: the names over the two who stand there, GO DOWN over them, its thread down to the hatch
            let notedBox = null;
            if (teamAct) {
                const whoBoxes = [];
                let room = 0;                                             // the tallest thing over a head at the hatch: a name, or the note
                team.forEach(id => {
                    const tag = T.who[Math.max(0, S.pick.slots.indexOf(id))];   // each place at the hatch keeps its own name tag
                    tag.set({ name: ctx.NAMES[id], why: S.pick.why[id] || '', tone: ctx.TONE[id], wrap: Math.floor(WHO_WRAP * u) + 'px' });
                    const [w, h] = tag.size(u), p = ctx.poseOf(id, t);
                    const cx = p && !p.hidden ? Math.round(p.x) + ctx.OFFX : 0;
                    room = Math.max(room, h, hatchNoteH(id, u));
                    whoBoxes.push({ id, tag, px: cx, x: clamp(Math.round(cx - w / 2), 2, SW - w - 2), y: headTop(id) - 4 - h, w, h });
                });
                T.go.set({ label: 'Go down', chips: dec.go ? goChips : null });
                const heads = team.map(headTop).concat(team.length ? [] : [headTop('vance')]);
                const [w, h] = T.go.size(u), top = Math.min(...heads) - 4 - Math.max(room, 18) - 7 - h;
                const go = { key: 'team', tag: T.go, kind: 'act', x: 34, y: top, w, h, tone: 'warm', icon: ICON.team, brackets: true, dim: team.length < 2 };
                go.anchor = anchorOf(teamAct, g, dc, site, [go.x, go.y, w, h]);
                go.thread = threadTo([go.x, go.y, w, h], go.anchor);
                L.items.push(go);
                if (note && team.includes(S.hover)) notedBox = true;
                if (dec.who) L.whoBoxes = spread(whoBoxes.filter(b => whoIds.includes(b.id)));
            }
            // Leave orbit: a lit key on Cora's console; the next step once nothing but settling is left
            if (leaveOn) {
                const [w, h] = T.key.size(u), next = !S.trip && !acts.some(a => a.key !== 'settle') && !teamAct;
                L.items.push({ key: 'leave', tag: T.key, kind: 'key', x: Math.round((DESK[0] + DESK[1]) / 2 - w / 2), y: Math.round(KEY_Y - h / 2), w, h, next });
            }
            // the note over someone pointed at: at the hatch it takes the place of their name, narrow, under GO DOWN
            if (note) {
                const atHatch = notedBox === true;
                T.note.set({ name: note.html ? '' : note.name, line: note.line, html: note.html, loss: note.loss, tone: note.tone, wrap: Math.floor((atHatch ? HATCH_NOTE_WRAP : 118) * u) + 'px' });
                const [w, h] = T.note.size(u), p = ctx.poseOf(S.hover, t);
                notedBox = null;
                if (p && !p.hidden) {
                    let x = clamp(Math.round(p.x + ctx.OFFX - w / 2), atHatch ? 30 : 4, Math.min(SW - 4, ROOM_R) - w);
                    const y = Math.max(4, headTop(S.hover) - 6 - h);
                    while (onDisc([x, y, w, h], dc, 6) && x > 4) x -= 4;
                    notedBox = [x, y, w, h];
                    L.items.push({ key: 'note:' + S.hover, tag: T.note, kind: 'note', x, y, w, h, tone: note.tone, brackets: true });
                }
            }
            (L.whoBoxes || []).forEach(b => {                             // a name the note covers steps back while it is up
                if (notedBox && (S.hover === b.id || overlaps([b.x, b.y, b.w, b.h], notedBox, 2))) return;
                L.items.push({ key: 'who:' + b.id, id: b.id, tag: b.tag, kind: 'who', x: b.x, y: b.y, w: b.w, h: b.h, px: b.px, tone: ctx.TONE[b.id] });
            });
            // what the glass shows for the tag pointed at
            const hot = L.items.find(it => it.key === S.hot);
            if (hot) L.preview = previewFor(hot, g, dc, site, t);
            lastL = L;
            return L;
        }
        function previewFor(it, g, dc, site, t) {
            const o = { t, still: still() };
            switch (it.key) {
                case 'scan': return { kind: 'scan', o: Object.assign(o, { disc: [dc[0], dc[1], g.kind === 'world' ? g.r : dc[2]] }) };
                case 'team': return { kind: 'route', o: Object.assign(o, { pts: GL.route(t, S.shownAt, 24) }) };
                case 'dock': return { kind: 'dock', o: Object.assign(o, { at: it.anchor }) };
                case 'mine': return { kind: 'reticle', o: Object.assign(o, { disc: [g.x, g.y, Math.max(8, Math.round(g.r * 0.34) + 5)] }) };
                case 'skim': return { kind: 'dive', o: Object.assign(o, { from: [site[0] + 62, site[1] - 92], to: site.map(Math.round), out: [site[0] - 54, site[1] - 66] }) };   // a skimming pass through the cloud tops
                case 'leave': return { kind: 'chevrons', o: Object.assign(o, { at: [WIN.x1 - 34, Math.round((WIN.y0 + WIN.y1) / 2)] }) };
                case 'strange': return { kind: 'target', o: Object.assign(o, { at: it.anchor }) };
                case 'settle': return { kind: 'flag', o: Object.assign(o, { at: it.anchor }) };
                default: return it.anchor ? { kind: 'rings', o: Object.assign(o, { at: it.anchor, tone: it.tone }) } : null;
            }
        }

        // ── drawing (frame canvas) ──
        function since(it, t) {
            if (!drawnAt.has(it.key)) return 0;                           // new this frame: apply() starts its draw-in (never a full frame first)
            return t - drawnAt.get(it.key);
        }
        function glass(c, t, L) {
            const mark = L.items.find(it => it.key === 'strange' && it.anchor);   // the strange site: a faint cold contact the glass marks
            if (!L.preview && !mark) return;
            c.save(); c.beginPath(); c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); c.clip();
            try {
                if (mark) TA.preview(c, 'mark', { at: mark.anchor, t, still: still() });
                if (L.preview) TA.preview(c, L.preview.kind, L.preview.o);
            } catch (err) { console.error('NewScreen stop: a preview failed', err); }
            c.restore();
        }
        function threads(c, t, L) {
            const calm = still();
            L.items.forEach(it => {
                if (!it.thread) return;
                const k = calm ? 1 : clamp01((since(it, t) - ARM_MS * 0.6) / THREAD_MS), hot = S.hot === it.key;
                if (k <= 0) return;
                TA.thread(c, it.thread, it.tone, { solid: hot, frac: k, lift: hot ? 1 : it.dim ? -1 : 0 });
                if (k >= 1) TA.pin(c, it.anchor[0], it.anchor[1], it.tone, { pulse: hot && !calm ? t - S.hotAt : null, lift: hot ? 1 : 0 });
            });
        }
        function tags(c, t, L) {
            const calm = still();
            if (L.stock && stockBox) TA.panel(c, stockBox[0], stockBox[1], stockBox[2], stockBox[3], t);
            L.items.forEach(it => {
                const k = calm ? 1 : clamp01(since(it, t) / ARM_MS), hot = S.hot === it.key;
                if (it.kind === 'key') {
                    TA.key(c, it.x, it.y, it.w, it.h, { hot, next: it.next, t, still: calm });
                    TA.icon(c, 'chevrons', it.x + 4, it.y + Math.floor((it.h - 9) / 2), 'warm', hot || it.next ? 1 : 0);
                    return;
                }
                TA.shade(c, it.x, it.y, it.w, it.h, Math.min(1, k * 1.6));
                if (it.brackets) TA.brackets(c, it.x, it.y, it.w, it.h, it.tone, k, hot);
                if (it.icon && k > 0.4) TA.icon(c, it.icon, it.x + 4, it.y + Math.floor((it.h - 9) / 2), it.tone, hot ? 1 : it.dim ? -1 : 0);
                if (it.kind === 'who') {                                  // a small caret under the name, over their head
                    const r = TA.ramp(it.tone), y = it.y + it.h + 1;
                    const cx = it.px ? clamp(Math.round(it.px), it.x + 3, it.x + it.w - 4) : it.x + Math.floor(it.w / 2);   // over their head, even when the name stepped aside
                    c.fillStyle = r[1]; c.fillRect(cx - 1, y, 3, 1); c.fillStyle = r[2]; c.fillRect(cx, y + 1, 1, 1);
                }
            });
        }

        // ── the DOM half ──
        function apply(t, L) {
            const now = performance.now(), on = new Set(), calm = still();
            let fresh = 0;
            L.items.forEach(it => {
                const tag = it.tag;
                on.add(tag);
                if (!drawnAt.has(it.key) || !tag.on || tag.key0 !== it.key) {
                    const lag = calm ? 0 : fresh++ * STAGGER;
                    drawnAt.set(it.key, t + lag); shownWall.set(it.key, now + lag);
                    tag.key0 = it.key; tag.show(false); tag.show(true, now + lag);
                }
                const [x, y] = ctx.css(it.x, it.y);
                tag.place(x, y);
                tag.flag('is-hot', S.hot === it.key);
                tag.flag('is-cool', it.tone === 'cool');
                tag.flag('is-wait', !!it.dim);
                tag.flag('is-next', !!it.next);
                tag.type(now, calm);
            });
            allTags().forEach(tag => { if (!on.has(tag)) { if (tag.on && tag.key0) { drawnAt.delete(tag.key0); shownWall.delete(tag.key0); } tag.show(false); tag.key0 = null; } });
            if (stock) { if (L.stock) placeStock(); else stock.hide(); }
            explain();
        }
        function hide() {
            if (!T) return;
            allTags().forEach(tag => { tag.show(false); tag.key0 = null; });
            drawnAt.clear(); shownWall.clear();
            if (stock) stock.hide();
            lastL = null; stockBox = null; frozen = null;
        }
        /** The ship's stock on the wall left of the window, one under another, right-aligned to the window's frame, in a small
            display set into the wall (drawn by tags(): its box is measured here, frame px). */
        let stockBox = null, stockAt = -1e9;
        function placeStock() {
            const [x, y] = ctx.css(WIN.x0 - 12, WIN.y0 + 30), gap = 10 * ctx.unit();
            window.NSStock.KEYS.forEach((k, i) => stock.put(k, x, y + i * gap, 'right'));
            const now = performance.now();
            if (stockBox && now - stockAt < 500) return;                 // measured twice a second (a number's width changes rarely)
            stockAt = now;
            const els = [...layer.querySelectorAll('.nss.on')];
            if (!els.length) { stockBox = null; return; }
            const rs = els.map(e => e.getBoundingClientRect()), u = ctx.unit(), [ox, oy] = ctx.css(0, 0);
            const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), b = Math.max(...rs.map(r => r.bottom));
            stockBox = [Math.floor((l - ox) / u) - 4, Math.floor((t - oy) / u) - 3, 0, 0];
            stockBox[2] = WIN.x0 - 7 - stockBox[0]; stockBox[3] = Math.ceil((b - oy) / u) + 3 - stockBox[1];
        }
        /** The pointer (CSS px) on an item's box (its frame px box, as placed: no layout is read). */
        function inside(it, cx, cy, pad) {
            const [x, y] = ctx.css(it.x, it.y), u = ctx.unit();
            return cx >= x - pad && cx <= x + it.w * u + pad && cy >= y - pad && cy <= y + it.h * u + pad;
        }
        function hit(cx, cy) {
            if (!lastL) return null;
            for (const it of lastL.items) {
                if (!it.tag.on || it.kind === 'title' || it.kind === 'note' || !inside(it, cx, cy, it.kind === 'who' ? 2 : 6)) continue;
                if (it.kind === 'key') return { kind: 'leave' };
                if (it.kind === 'who') return { kind: 'who', id: it.id };
                return { kind: 'act', key: it.key };
            }
            return null;
        }
        const fresh = key => performance.now() - (shownWall.get(key) || 0) < GUARD_MS;
        function skyY() {
            const it = lastL && lastL.items.find(q => q.kind === 'title');
            return it ? it.y + it.h + 4 : WIN.y0 + 8;
        }

        /** A.U.R.A. says once a run what an action on screen does (NSOrbit.TELL): one line at a time, the one pointed at first.
            Only an action that has stayed on screen a moment, and only while it is still there when its turn comes. The team's
            line waits until the two are at the hatch and someone else could go instead. */
        function explain() {
            const v = NS.mods.voice, tell = (window.NSOrbit && window.NSOrbit.TELL) || {};
            if (telling || !lastL || !v || typeof v.once !== 'function' || typeof v.told !== 'function') return;
            const now = performance.now(), team = ctx.team();
            const ready = key => key !== 'team' || (team.length === 2 && team.every(ctx.arrived) && S.lineup.length >= 3);
            const shown = lastL.items.filter(it => (it.kind === 'act' || it.kind === 'key') && it.tag.on && now - (shownWall.get(it.key) || now) >= TELL_AFTER_MS && ready(it.key)).map(it => it.key);
            const key = (S.hot && shown.includes(S.hot) ? [S.hot] : []).concat(shown).find(k => tell[k] && !v.told('act:' + k));
            if (!key) return;
            telling = true;
            const text = String(tell[key]).replace('{team}', team.map(id => ctx.NAMES[id]).join(' and '));
            const done = () => { telling = false; };
            const stillThere = () => S.open && !S.dive && !!lastL && lastL.items.some(it => it.key === key && it.tag.on) && ready(key);
            v.once('act:' + key, text, stillThere).then(done, err => { done(); console.error('NewScreen stop: the voice failed', err); });
        }
        const debug = () => (T ? allTags().filter(tag => tag.on).map(tag => ({ key: tag.key0, text: tag.el.textContent, rect: (r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])(tag.el.getBoundingClientRect()) })) : []);
        return { init, layout, glass, threads, tags, apply, hide, hit, fresh, noteUp: () => !!(T && T.note.on), skyY, debug };
    }

    window.NSStopWords = Object.freeze({ create });
})();
