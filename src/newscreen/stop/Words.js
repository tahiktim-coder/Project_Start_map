/* ═══ Silent Exodus · new screen (?new=1) · stop/Words.js: what the bridge's glass shows, and where ══════════════════════
   What it is: the words of a stop, laid out on the bridge as parts of the ship (the window is the ship's display):
   - the glass's title, top left: the world's name in capitals, under it what kind of world it is (WorldFinds.js: "A singing
     world. One low note comes off it.") and, once scanned, whether people could live there (Scan.js);
   - each action as a glass tag (amber corner brackets, a dither shade, a pixel icon, the label in capitals, its cost and
     gain as chips) beside what it acts on, with a thin dotted thread to an anchor ON the target: Scan to the world's limb,
     Dock to the station's port, Mine to the biggest rock, Refuel to the cloud tops, Fly closer and Settle here to the
     landing site, Answer the call to the blink in the sky, Date the wreck to Mira's screen, Go into the light to the light;
   - Scan is one click: the glass sweeps the world, then each find (WorldFinds.js, 1 to 3: the places a team can go) is a
     glass tag in the sky beside the world, its thread to its mark ON the world: what it is, what it can give, a clue toward
     our ship, its risk ("risk 12%"); a visited one says "done". They keep below the room A.U.R.A. speaks in under the
     title (two lines) while they fit there. A click on a find (its tag or its mark) makes it where GO
     DOWN goes: its mark in brackets, and the shuttle's path ends there (NSGlass.aim). Pointing at it shows that path;
   - the team's "GO DOWN" tag over the hatch (the two names, the risk where they go; "Go across" when the trip goes to a site
     in orbit, the wreckage, where nobody lands), and over each of the two at the hatch their first name in their colour and
     why they go;
   - "Leave orbit" as a lit key on Cora's console (it glows as the next step once nothing but settling is left);
   - the note over someone pointed at: at the hatch what they are good for; at the window "Aris goes instead of Vance" and
     what the ship loses while they are down; too weak, why;
   - the ship's stock on the wall left of the window (NSStock).
   A tag draws in from its corners, its label types on, its thread reaches out (80 ms apart, 125 ms steps); pointed at, it
   brightens, its thread turns solid with a pulse at the anchor, and the glass shows what it does (stop/TagArt.js).
   At most 40 words on screen (the voice line counted): the world's name, the labels, the key and the stock first, then
   the kind line, the chosen find's chips, the names at the hatch, the team's chips, whether people could live there, the
   other finds' chips, the actions' chips. Decided afresh only while nothing is pointed at: nothing moves under the pointer
   (but a click that chooses another find shows its chips at once). Words never sit over the world's disc or a person. Settle here is cool grey, never warm.
   The first time an action shows, A.U.R.A. says once what it does (NSOrbit.TELL), one at a time, the pointed-at first; and
   once how to choose a find.
   Loaded only when the new-screen switch is on, after stop/TagArt.js and stop/Tags.js, before stop/Stop.js.

   window.NSStopWords (frozen)
     create(ctx) → words     ctx from Stop.js: { S, css, unit, t0, poseOf, picking, team, arrived, joinedLast, isWrongPlace,
                             proposed, sweep() → ms into the scan's sweep | null, sprite(id), NAMES, TONE, CREW, OFFX, F,
                             HATCH, NAV, HELM } (frame px); S.finds: the world's finds (NewScreen.flow.finds)
     words.init(layer)       the tags and the stock in #ns-stop-words
     words.layout(t) → L     what shows where now (frame px), or null before the world has braked in
     words.glass(c, t, L)    what a pointed-at tag shows on the glass, and the scan's sweep (drawn under the room's frame)
     words.threads(c, t, L)  the threads and their pins, the finds' marks (under the people)
     words.tags(c, t, L)     shades, brackets, icons, the helm key (over everything)
     words.apply(t, L)       the DOM half: place, show, type on; A.U.R.A.'s first-time lines
     words.hide()            all off;  words.hit(cx, cy) → { kind: 'act' | 'leave' | 'who' | 'find', key?, id? } | null (CSS px)
     words.fresh(key) → bool shown less than 400 ms ago (a click is ignored);  words.noteUp(), words.skyY() (frame y)
     words.markTop(id) → frame y | null   the top of the copy's state mark over a person (a line said beside them goes above)
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
    const WEAK_LINE = "I went without supper. I'm too weak to go this time.";   // too weak for this trip (GameState.serveSupper)
    const DESK = [334, 429], KEY_Y = 290;                                 // Cora's console front (frame px): the helm key sits on it
    const KEY_TOP_TWO = 266;                                              // two held keys with their chips (the copy of Earth): the first one's top, so both fit the console
    const ROOM_R = 606;                                                   // frame px: the inside of the bridge's right wall (a note never runs onto the hull)
    const WHO_WRAP = 44;                                                  // frame px: the most a name over someone at the hatch may spread
    const WHO_GAP = 3;                                                    // frame px: kept between the two names at the hatch
    const HATCH_NOTE_WRAP = 78;                                           // frame px: the note over someone at the hatch, narrow (it sits under GO DOWN)
    const MAX_FINDS = 3, MARK_HIT = 7;                                    // a world's finds at most (WorldFinds.js); frame px round a mark that takes a click
    const VOICE_ROOM = 38;                                                // frame px: two of A.U.R.A.'s lines under the title (Stop.js 'stop:aura', 1280 wide and up)
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
            T = { title: TG.make(layer, 'title'), acts: [0, 1, 2, 3].map(() => TG.make(layer, 'act')), go: TG.make(layer, 'act'), key: TG.make(layer, 'key'), settle: TG.make(layer, 'key'),
                who: [TG.make(layer, 'who'), TG.make(layer, 'who')], note: TG.make(layer, 'note'), probe: TG.make(layer, 'note'),
                titleProbe: TG.make(layer, 'title'),                     // never shown: the title with every row, measured (the room kept under it)
                finds: Array.from({ length: MAX_FINDS }, () => TG.make(layer, 'act')),
                marks: Array.from({ length: 5 }, () => TG.make(layer, 'who')) };   // the copy of Earth: what the fall did to each of them
            T.key.set({ label: 'Leave orbit' });
            T.settle.set({ label: 'Settle here' });
            stock = window.NSStock ? window.NSStock.board(layer) : null;
        }
        const allTags = () => [T.title, T.go, T.key, T.settle, T.note].concat(T.acts, T.who, T.finds, T.marks);

        // ── geometry ──
        /** The top of someone's head standing at floor row F (frame px): their idle sprite's first painted row. */
        function headTop(id, act) {
            const k = id + ':' + (act || 'idle');
            if (!heads.has(k)) {
                let row = 0;
                try {
                    const Sp = ctx.sprite(id, act), d = Sp.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, Sp.w, Sp.h).data;
                    outer: for (let y = 0; y < Sp.h; y++) for (let x = 0; x < Sp.w; x++) if (d[(y * Sp.w + x) * 4 + 3]) { row = y; break outer; }
                    heads.set(k, { row, oy: Sp.origin.y });
                } catch (err) { heads.set(k, { row: 4, oy: 101 }); }
            }
            const h = heads.get(k);
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
                case 'settle': return (S.finds || []).length && g.kind === 'world' ? limb(dc, box) : site.map(Math.round);   // the finds hold the landing site's marks: settling is the world itself
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
        /** Under the world's name: what kind of world it is (WorldFinds.js). What it holds, what it gives and how risky it is
            now show on its finds. */
        function kindLine() {
            try { const K = window.NSWorldFinds, k = K && S.node ? K.kind(S.node) : null; return k ? k.text : ''; } catch (err) { console.error('NewScreen stop: the kind line failed', err); return ''; }
        }
        /** Settling is offered only where our scan says people could live (good or hard), and always on Eden. */
        function homeable() {
            if (S.node && (S.node.isEden || S.node.type === 'EDEN')) return true;
            let f = null;
            try { f = NS.flow && typeof NS.flow.facts === 'function' && S.id ? NS.flow.facts(S.id) : null; } catch (err) { console.error('NewScreen stop: the scan facts failed', err); }
            return !!f && (f.tier === 'good' || f.tier === 'marginal');
        }
        /** Once scanned: whether people could live there (Scan.js, the tier the settle question reads). */
        function liveRow() {
            let f = null;
            try { f = NS.flow && typeof NS.flow.facts === 'function' && S.id ? NS.flow.facts(S.id) : null; } catch (err) { console.error('NewScreen stop: the scan facts failed', err); }
            return f && f.live ? [{ icon: 'live', text: cap(f.live) }] : null;
        }
        /** A find's chips: what it can give, a clue toward our ship, its risk; a visited one only says so. */
        function findChips(f) {
            if (f.done) return [{ icon: 'done', text: 'done', tone: 'done' }];
            const out = (f.gives || []).map(c => ({ icon: c.icon, text: c.text }));
            if (f.hint) out.push({ icon: 'where', text: 'a clue', tone: 'gain' });
            if (typeof f.risk === 'number') out.push({ icon: 'risk', text: `risk ${f.risk}%`, tone: f.risk >= 30 ? 'high' : 'risk' });
            return out;
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
            const verb = goesAcross() ? 'goes across' : 'goes down';             // to the wreckage in orbit nobody lands
            const html = S.lineup.length <= 2 ? `${b(id)} ${verb}` : out ? `${b(id)} goes instead of ${b(out)}` : team.length ? `${b(id)} goes with ${b(team[0])}` : `${b(id)} ${verb}`;
            const text = html.replace(/<[^>]+>/g, '');
            return { html, text, loss: loss ? cap(loss) + '.' : `Nothing aboard needs ${id === 'aris' || id === 'mira' ? 'her' : 'him'} this time.`, tone };
        }

        // ── the words budget: at most 40 on screen (the voice line counted, unless a note has stepped it back). The world's
        //    name, the labels, the key and the stock always; then, while they fit: the kind line, the chosen find's chips, the
        //    names at the hatch (both or neither), the team's chips, whether people could live there, the other finds' chips,
        //    each action's chips. Decided afresh only while nothing is pointed at: what is on screen holds still under the pointer
        //    (a click that chooses another find is the one exception: the player asked to see it) ──
        let frozen = null;
        function decide(o) {
            const aimed = o.finds.find(f => f.target), aimedId = aimed ? aimed.id : null;
            if ((S.hot || S.hover) && frozen && frozen.aimed === aimedId) return frozen;   // a click that chose another find: decided once more, its chips show
            const voice = !o.note && NS.mods.voice && NS.mods.voice.current ? NS.mods.voice.current() : null;
            let budget = MAX_WORDS - (voice ? wordsIn(voice.who) + wordsIn(voice.line) : 0);
            const take = n => { if (n <= 0) return true; if (budget - n >= 0) { budget -= n; return true; } return false; };
            o.acts.forEach(a => { budget -= wordsIn(a.words); });
            o.finds.forEach(f => { budget -= wordsIn(f.label); });
            if (o.team) budget -= 2;
            if (o.leave) budget -= 2;
            (o.keys || []).forEach(a => { budget -= wordsIn(a.words); });
            if (o.stock) budget -= window.NSStock.KEYS.length;
            if (o.name) budget -= wordsIn(o.name);
            if (o.note) budget -= wordsIn(o.note.name) + wordsIn(o.note.text || o.note.line) + wordsIn(o.note.loss);
            const dec = { act: {}, find: {}, keys: {}, aimed: aimedId };
            (o.keys || []).forEach(a => { dec.keys[a.key] = take(chipWords([].concat(...(a.chips || []).map(c => (Array.isArray(c) ? c : [c]))))); });   // what a held key costs: first
            dec.marks = !!(o.marks && o.marks.length) && take(o.marks.reduce((n, m) => n + 1 + wordsIn(m.text), 0));   // then what the fall did to each of them
            dec.kind = !!o.kind && take(wordsIn(o.kind));
            if (aimed) dec.find[aimed.id] = take(chipWords(aimed.chips));
            dec.who = !!o.team && take(o.whoIds.reduce((n, id) => n + 1 + wordsIn(S.pick.why[id] || ''), 0));
            const named = dec.who ? o.goChips.filter(c => c.tone === 'who' && o.whoIds.some(id => ctx.NAMES[id] === c.text)).length : 0;   // read once: the same names stand over their heads
            dec.go = !!o.team && take(chipWords(o.goChips) - named);
            dec.facts = !!o.live && take(chipWords(o.live));
            o.finds.forEach(f => { if (!(f.id in dec.find)) dec.find[f.id] = take(chipWords(f.chips)); });
            o.acts.forEach(a => { dec.act[a.key] = take(chipWords(a.chips)); });
            frozen = dec;
            return dec;
        }
        /** Does this trip go to a site in orbit (the wreckage), where the lander crosses and nobody lands? The find chosen; before
            a scan, where a blind trip goes (WorldFinds.blind). Worked out again only when the world or its finds change. */
        let across = { key: null, value: false };
        function goesAcross() {
            const finds = S.finds || [], node = S.node, key = node ? `${node.id}|${node.nsTrips || 0}|${finds.map(f => f.id + (f.target ? '*' : '') + (f.done ? '-' : '')).join(',')}` : null;
            if (key === across.key) return across.value;
            let value = false;
            const aimed = finds.find(f => f.target);
            if (aimed) value = !!aimed.inSpace;
            else if (!finds.length && node) {
                try { const F = window.NSWorldFinds, b = F && window.app ? F.blind(window.app, node) : null; value = !!(b && b.inSpace); } catch (err) { console.error('NewScreen stop: where the trip goes failed', err); }
            }
            across = { key, value };
            return value;
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
            const u = ctx.unit(), busy = !!S.send, wrong = ctx.isWrongPlace(), picking = ctx.picking(), sweeping = ctx.sweep() != null;
            const g = GL.geom(t, S.shownAt), dc = GL.disc(t, S.shownAt) || [g.x, g.y, g.r], site = GL.site(t, S.shownAt);
            const rank = a => { const i = WORTH.indexOf(a.key); return i < 0 ? WORTH.length : i; };
            const settleAct = S.actions.find(a => a.key === 'settle') || null;   // never on the glass: its own key at the helm (below)
            const keyActs = S.actions.filter(a => a.near === 'key');              // the copy of Earth's two held keys (Orbit.js): on the console too
            const CPY = window.NSCopy, strained = wrong && !!(CPY && CPY.fighting());   // the engines straining: only the keys stay
            const best = S.actions.filter(a => a !== settleAct && a.near !== 'key').sort((a, b) => rank(a) - rank(b)).slice(0, MAX_LIT);
            const shown = busy || strained ? [] : S.actions.filter(a => best.includes(a) && !(sweeping && a.key === 'scan'));   // the glass is sweeping: Scan is under way
            const teamAct = shown.find(a => a.team && picking && ctx.proposed()) || null, acts = shown.filter(a => !a.team);
            // each action keeps its own tag while it stays on screen (a neighbour going never makes it draw in again)
            const used = new Set(), tagOf = new Map();
            acts.forEach(a => { const tg = T.acts.find(q => q.key0 === a.key); if (tg) { used.add(tg); tagOf.set(a.key, tg); } });
            acts.forEach(a => { if (tagOf.has(a.key)) return; const tg = T.acts.find(q => !used.has(q)); used.add(tg); tagOf.set(a.key, tg); });
            const L = { t, items: [], preview: null, stock: !NS.blocked() && !!stock, marks: [] };
            const leaveOn = !busy && !wrong, note = noteFor(S.hover), team = teamAct ? ctx.team() : [];
            const goChips = teamAct ? teamChips() : [], whoIds = team.filter(ctx.arrived);
            const nameText = S.node && !wrong ? titleCase(S.node.name || '') : '', kind = nameText ? kindLine() : '', live = nameText ? liveRow() : null;   // the copy has no name on the glass
            const marks = wrong && CPY && !busy ? CPY.marks(t) || [] : [];
            // the world's finds (WorldFinds.js): shown once the glass has swept it, never while the team is on its way
            const ground = g.kind === 'world' || g.kind === 'giant', allFinds = ground && !sweeping ? (S.finds || []).slice(0, MAX_FINDS) : [];
            const finds = busy ? [] : allFinds.map((f, i) => ({ f, id: f.id, label: f.label, chips: findChips(f), target: !!f.target, tag: T.finds[i] }));
            if (busy) allFinds.filter(f => f.target).forEach(f => L.marks.push({ at: GL.spot(t, S.shownAt, f.at), state: 'target' }));   // where they are going stays marked
            const dec = decide({ acts, finds, team: !!teamAct, leave: leaveOn, keys: busy ? [] : keyActs, marks, stock: L.stock, note, goChips, whoIds, name: nameText, kind, live });

            // the glass's title: the world's name, what kind of world it is, and once scanned whether people could live there
            let titleBox = null, voiceFloor = null;
            if (nameText) {
                const rows = [kind ? [{ text: kind, tone: 'kind' }] : null, live].filter(Boolean);
                T.title.set({ label: nameText, rows: rows.filter(r => (r === live ? dec.facts : dec.kind)) });
                const [w, h] = T.title.size(u);
                titleBox = [WIN.x0 + 6, WIN.y0 + 5, w, h];
                L.items.push({ key: 'title', tag: T.title, kind: 'title', x: titleBox[0], y: titleBox[1], w, h, tone: 'cool', brackets: true });
                T.titleProbe.set({ label: nameText, rows });                 // A.U.R.A. speaks under the title: the finds keep below her two lines,
                voiceFloor = titleBox[1] + T.titleProbe.size(u)[1] + 4 + VOICE_ROOM;   // measured from the whole title, so nothing moves when a row hides
            }
            // the actions beside what they act on
            const boxes = [];
            const add = (a, x, y, w, h) => {
                const item = { key: a.key, tag: tagOf.get(a.key), kind: 'act', x, y, w, h, tone: a.key === 'settle' ? 'cool' : 'warm', icon: ICON[a.key], brackets: true };
                item.anchor = anchorOf(a, g, dc, site, [x, y, w, h]);
                item.thread = item.anchor ? threadTo([x, y, w, h], item.anchor) : null;
                L.items.push(item); boxes.push([x, y, w, h]);
            };
            /** A find's tag (kind 'find'), its thread to its mark ON the world; a visited one cool grey and dimmed. */
            const addFind = (v, x, y, w, h, at) => {
                const item = { key: 'find:' + v.id, id: v.id, tag: v.tag, kind: 'find', x, y, w, h, tone: v.f.done ? 'cool' : 'warm', icon: v.f.icon, brackets: true,
                    dim: !!v.f.done, target: v.target, at: v.f.at, anchor: at.map(Math.round) };
                item.thread = threadTo([x, y, w, h], item.anchor);
                L.items.push(item); boxes.push([x, y, w, h]);
            };
            const sized = acts.map(a => { const tg = tagOf.get(a.key); tg.set({ label: a.words, chips: dec.act[a.key] ? a.chips : null }); return tg.size(u); });
            const stack = acts.filter(a => NEAR_WORLD.includes(a.near) || a.near === 'call' || (a.near === 'under' && !wrong))   // the call too: last, its thread runs down to the blink
                .sort((a, b) => (a.near === 'call') - (b.near === 'call'));
            // the finds first, in the order of their marks (top to bottom: no thread crosses another), each level with its mark
            // where it can be; the actions under them (or, with no finds, starting by the landing site as before)
            const column = finds.map(v => { v.tag.set({ label: v.label, chips: dec.find[v.id] ? v.chips : null }); const [w, h] = v.tag.size(u); return { v, w, h, at: GL.spot(t, S.shownAt, v.f.at) }; })
                .sort((a, b) => a.at[1] - b.at[1]);
            if (stack.length || column.length) {
                let right = g.kind === 'giant' ? Math.round(site[0] + 76) : Math.round(dc[0] - dc[2] - 14), top = g.kind === 'giant' ? Math.round(site[1] - 84) : Math.round(site[1] - 16);   // a giant: in the sky over the cloud tops
                if (g.kind === 'station' && stack.length) top = Math.round(g.y + g.r * 11 / 24 - sized[acts.indexOf(stack[0])][1] / 2);   // level with the port: the thread runs under the panels
                right = Math.max(WIN.x0 + 72, right);
                const list = column.map(e => ({ find: e, w: e.w, h: e.h, want: Math.round(e.at[1] - e.h / 2) }))
                    .concat(stack.map((a, i) => { const [w, h] = sized[acts.indexOf(a)]; return { act: a, w, h, want: !column.length && i === 0 ? top : null }; }));
                const floor = WIN.y1 - 32, widest = Math.max(...list.map(q => q.w)), need = list.reduce((n, q) => n + q.h + GAP, -GAP);
                const ceil0 = titleBox && right - widest < titleBox[0] + titleBox[2] + 4 ? titleBox[1] + titleBox[3] + 8 : WIN.y0 + 5;
                const ceil = column.length && voiceFloor != null ? Math.max(ceil0, Math.min(voiceFloor, floor - need)) : ceil0;   // her room, while the column fits under it
                let cursor = ceil;
                list.forEach(q => { q.y = Math.max(cursor, q.want != null ? q.want : cursor); cursor = q.y + q.h + GAP; });
                let limit = floor;                                        // too low: pushed up from the bottom, never over the title
                for (let i = list.length - 1; i >= 0; i--) { list[i].y = Math.min(list[i].y, limit - list[i].h); limit = list[i].y - GAP; }
                cursor = ceil;
                list.forEach(q => { q.y = Math.max(q.y, cursor); cursor = q.y + q.h + GAP; });
                if (g.kind === 'world') {                                 // a moon, a ring or debris on the world's left: the column keeps clear of it too
                    const edge = pictureLeft(g, list[0].y - 4, cursor - GAP + 4);
                    if (edge != null) right = Math.max(WIN.x0 + 72, Math.min(right, edge - 10));
                }
                list.forEach(q => {
                    let x = right - q.w;
                    while (onDisc([x, q.y, q.w, q.h], dc, 4) && x > WIN.x0 + 4) x -= 2;
                    if (q.act) add(q.act, x, q.y, q.w, q.h);
                    else addFind(q.find.v, x, q.y, q.w, q.h, q.find.at);
                });
            }
            acts.filter(a => !stack.includes(a)).forEach(a => {
                const [w, h] = sized[acts.indexOf(a)];
                let x, y;
                if (a.near === 'mira') {
                    const p = ctx.poseOf('mira', t), mx = p && !p.hidden ? Math.round(p.x) + ctx.OFFX : ctx.NAV;
                    x = mx + 8; y = headTop('mira') - h - 3;              // over her shoulder, clear of her head; its thread drops to her screen
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
                T.go.set({ label: goesAcross() ? 'Go across' : 'Go down', chips: dec.go ? goChips : null });   // DRAFT 'Go across': to the wreckage in orbit, nobody lands
                const heads = team.map(id => headTop(id)).concat(team.length ? [] : [headTop('vance')]);
                const [w, h] = T.go.size(u), top = Math.min(...heads) - 4 - Math.max(room, 18) - 7 - h;
                const go = { key: 'team', tag: T.go, kind: 'act', x: 34, y: top, w, h, tone: 'warm', icon: ICON.team, brackets: true, dim: team.length < 2 };
                go.anchor = anchorOf(teamAct, g, dc, site, [go.x, go.y, w, h]);
                go.thread = threadTo([go.x, go.y, w, h], go.anchor);
                L.items.push(go);
                if (note && team.includes(S.hover)) notedBox = true;
                if (dec.who) L.whoBoxes = spread(whoBoxes.filter(b => whoIds.includes(b.id)));
            }
            // Leave orbit: a lit key on Cora's console; the next step once nothing is left to do here
            let keyBottom = KEY_Y;
            const deskX = w => Math.round((DESK[0] + DESK[1]) / 2 - w / 2), held = key => (ctx.holdKey && ctx.holdKey() === key && ctx.hold ? ctx.hold() : 0);
            const fightAct = busy ? null : keyActs.find(a => a.key === 'escape') || null, downAct = busy ? null : keyActs.find(a => a.key === 'accept') || null;
            if (leaveOn) {
                T.key.set({ label: 'Leave orbit' });
                const [w, h] = T.key.size(u), next = !S.trip && !acts.length && !teamAct && !finds.some(v => !v.f.done);
                L.items.push({ key: 'leave', tag: T.key, kind: 'key', x: deskX(w), y: Math.round(KEY_Y - h / 2), w, h, next });
                keyBottom = Math.round(KEY_Y + h / 2);
            } else if (fightAct) {                                        // the copy of Earth: Fight to escape where Leave orbit sits, held (stop/Copy.js)
                const rows = (fightAct.chips || []).every(Array.isArray) ? fightAct.chips : [fightAct.chips || []];
                T.key.set({ label: fightAct.words, rows: dec.keys.escape ? rows.filter(r => r.length) : null });
                const [w, h] = T.key.size(u), y = KEY_TOP_TWO;
                L.items.push({ key: 'escape', tag: T.key, kind: 'key', x: deskX(w), y, w, h, tone: 'warm', icon: 'escape', hold: ctx.fight ? ctx.fight() : 0 });
                keyBottom = y + h - 1;
            }
            // Settle here: the one choice that ends the journey. Never a tag among the others: a quiet grey key under Leave orbit,
            // only once our scan says people could live here (or on Eden), and held down, not clicked (Stop.js SETTLE_HOLD_MS).
            // At the copy of Earth the same key is "Go down" (it IS settling, on the trap), its chip under its word.
            if (settleAct && !busy && !wrong && !S.trip && homeable()) {
                T.settle.set({ label: 'Settle here' });
                const [w, h] = T.settle.size(u);
                const item = { key: 'settle', tag: T.settle, kind: 'key', x: deskX(w), y: keyBottom + 4, w, h, tone: 'cool', hold: held('settle') };
                item.anchor = site.map(Math.round);                     // where the flag would stand (its preview), no thread
                L.items.push(item);
            } else if (downAct) {
                T.settle.set({ label: downAct.words, chips: dec.keys.accept ? downAct.chips : null });
                const [w, h] = T.settle.size(u);
                L.items.push({ key: 'accept', tag: T.settle, kind: 'key', x: deskX(w), y: keyBottom + 4, w, h, tone: 'cool', icon: 'shuttle', hold: held('accept') });
            }
            // the copy of Earth, a moment after the fall: over each person what it did to them ("+1 stress", "hurt"), in red; while one
            // of them talks, their line sits over their mark (Stop.js anchors) and names them, so the mark drops its name
            const talker = NS.mods.voice && NS.mods.voice.speaking ? NS.mods.voice.speaking() : null;
            (dec.marks ? marks : []).forEach((m, i) => {
                const tag = T.marks[i], p = ctx.poseOf(m.id, t);
                if (!tag || !p || p.hidden) return;
                tag.set({ name: talker === m.id ? '' : ctx.NAMES[m.id], why: m.text, tone: ctx.TONE[m.id], wrap: Math.floor(WHO_WRAP * u) + 'px' });
                const [w, h] = tag.size(u), cx = Math.round(p.x) + ctx.OFFX + (m.lying ? -42 * (p.facing || 1) : 0), top = m.lying ? ctx.F - 26 : headTop(m.id, p.act);   // lying: over their head, clear of whoever kneels by them
                L.items.push({ key: 'mark:' + m.id, id: m.id, tag, kind: 'who', state: true, x: clamp(Math.round(cx - w / 2), 2, SW - w - 2), y: top - 4 - h, w, h, px: cx, tone: ctx.TONE[m.id] });
            });
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
            if (it.kind === 'find') return it.dim ? null : { kind: 'route', o: Object.assign(o, { pts: GL.route(t, S.shownAt, 24, it.at) }) };   // the shuttle's way to it
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
            const sweep = ctx.sweep();                                    // Scan was clicked: the glass sweeps the world's face once
            if (!L.preview && !mark && sweep == null) return;
            c.save(); c.beginPath(); c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); c.clip();
            try {
                if (mark) TA.preview(c, 'mark', { at: mark.anchor, t, still: still() });
                if (sweep != null) { const g = GL.geom(t, S.shownAt), dc = GL.disc(t, S.shownAt) || [g.x, g.y, g.r]; TA.preview(c, 'scan', { disc: [dc[0], dc[1], g.kind === 'world' ? g.r : dc[2]], t: sweep, still: false }); }
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
                TA.thread(c, it.thread, it.tone, { solid: hot || !!it.target, frac: k, lift: hot ? 1 : it.dim ? -1 : 0 });
                if (k < 1) return;
                if (it.kind === 'find') {                                 // the find's mark on the world: a ring goes out once as it is found
                    TA.findMark(c, it.anchor[0], it.anchor[1], { state: it.dim ? 'done' : it.target ? 'target' : 'open', hot, pulse: hot && !calm ? t - S.hotAt : null,
                        born: calm ? null : since(it, t) - ARM_MS * 0.6 - THREAD_MS, t, still: calm });
                } else TA.pin(c, it.anchor[0], it.anchor[1], it.tone, { pulse: hot && !calm ? t - S.hotAt : null, lift: hot ? 1 : 0 });
            });
            (L.marks || []).forEach(m => TA.findMark(c, m.at[0], m.at[1], { state: m.state, t, still: calm }));   // the team on its way: where they go
        }
        function tags(c, t, L) {
            const calm = still();
            if (L.stock && stockBox) TA.panel(c, stockBox[0], stockBox[1], stockBox[2], stockBox[3], t);
            L.items.forEach(it => {
                const k = calm ? 1 : clamp01(since(it, t) / ARM_MS), hot = S.hot === it.key, lit = hot || !!it.target;   // the find chosen stays lit
                if (it.kind === 'key') {
                    const cool = it.tone === 'cool';
                    TA.key(c, it.x, it.y, it.w, it.h, { hot, next: it.next, t, still: calm, tone: it.tone, fill: it.hold || 0, fillH: it.tag.lh || 0 });
                    TA.icon(c, it.icon || (cool ? 'flag' : 'chevrons'), it.x + 4, it.y + (it.h > 16 ? 3 : Math.floor((it.h - 9) / 2)), cool ? 'cool' : 'warm', hot || it.next ? 1 : 0);   // with chips: level with its word
                    return;
                }
                TA.shade(c, it.x, it.y, it.w, it.h, Math.min(1, k * 1.6));
                if (it.brackets) TA.brackets(c, it.x, it.y, it.w, it.h, it.tone, k, lit);
                if (it.icon && k > 0.4) TA.icon(c, it.icon, it.x + 4, it.y + Math.floor((it.h - 9) / 2), it.tone, lit ? 1 : it.dim ? -1 : 0);
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
                tag.flag('is-hot', S.hot === it.key || !!it.target);
                tag.flag('is-cool', it.tone === 'cool');
                tag.flag('is-wait', !!it.dim);
                tag.flag('is-next', !!it.next);
                tag.flag('is-state', !!it.state);
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
                if (it.kind === 'key') return { kind: it.key === 'settle' || it.key === 'accept' ? 'settle' : it.key === 'escape' ? 'fight' : 'leave', key: it.key };
                if (it.kind === 'who') return { kind: 'who', id: it.id };
                if (it.kind === 'find') { if (it.dim) continue; return { kind: 'find', id: it.id, key: it.key }; }   // a visited find takes no click
                return { kind: 'act', key: it.key };
            }
            const [ox, oy] = ctx.css(0, 0), u = ctx.unit(), fx = (cx - ox) / u, fy = (cy - oy) / u;   // a find's mark on the world takes a click too
            const m = lastL.items.find(it => it.kind === 'find' && it.tag.on && !it.dim && Math.hypot(it.anchor[0] - fx, it.anchor[1] - fy) <= MARK_HIT);
            return m ? { kind: 'find', id: m.id, key: m.key } : null;
        }
        const fresh = key => performance.now() - (shownWall.get(key) || 0) < GUARD_MS;
        /** The top of the mark over a person at the copy (frame y), or null: a line said beside them goes above it. */
        function markTop(id) {
            const it = lastL && lastL.items.find(q => q.key === 'mark:' + id);
            return it ? it.y : null;
        }
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
            const copy = ctx.isWrongPlace(), CPY = window.NSCopy;
            if (copy && CPY && CPY.talking()) return;                    // the copy of Earth: the crew's talk first
            const now = performance.now(), team = ctx.team();
            const ready = key => key !== 'team' || (team.length === 2 && team.every(ctx.arrived) && S.lineup.length >= 3);
            const seen = it => it.tag.on && now - (shownWall.get(it.key) || now) >= TELL_AFTER_MS;
            const isFind = it => it.kind === 'find' && !it.dim;                                // the finds: told once, as one ('find')
            const shown = lastL.items.filter(it => (it.kind === 'act' || it.kind === 'key') && seen(it) && ready(it.key) && !(copy && (it.key === 'scan' || (CPY && CPY.used(it.key))))).map(it => it.key)   // the copy: A.U.R.A.'s scan line is its own; a key pressed needs no telling
                .concat(lastL.items.some(it => isFind(it) && seen(it)) ? ['find'] : []);
            const key = (S.hot && shown.includes(S.hot) ? [S.hot] : []).concat(shown).find(k => tell[k] && !v.told('act:' + k));
            if (!key) return;
            telling = true;
            const text = String(tell[key]).replace('{team}', team.map(id => ctx.NAMES[id]).join(' and '));
            const done = () => { telling = false; };
            const stillThere = () => S.open && !S.dive && !!lastL && lastL.items.some(it => (key === 'find' ? isFind(it) : it.key === key) && it.tag.on) && ready(key);
            v.once('act:' + key, text, stillThere).then(done, err => { done(); console.error('NewScreen stop: the voice failed', err); });
        }
        const debug = () => (T ? allTags().filter(tag => tag.on).map(tag => ({ key: tag.key0, text: tag.el.textContent, rect: (r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])(tag.el.getBoundingClientRect()) })) : []);
        return { init, layout, glass, threads, tags, apply, hide, hit, fresh, noteUp: () => !!(T && T.note.on), skyY, markTop, debug };
    }

    window.NSStopWords = Object.freeze({ create });
})();
