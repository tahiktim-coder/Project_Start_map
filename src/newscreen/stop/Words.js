/* ═══ Silent Exodus · new screen (?new=1) · stop/Words.js: what the bridge's glass shows, and where ══════════════════════
   What it is: the words of a stop, laid out on the bridge as parts of the ship (the window is the ship's display):
   - the glass's title, top left: the world's name in capitals, under it what kind of world it is (WorldFinds.js: "A singing
     world. One low note comes off it.") and, once scanned, whether people could live there (Scan.js);
   - each action as a glass tag (amber corner brackets, a dither shade, a pixel icon, the label in capitals, its cost and
     gain as chips) beside what it acts on, with a thin dotted thread to an anchor ON the target: Scan to the world's limb,
     Dock to the station's port, Mine to the biggest rock, Refuel to the cloud tops, Fly closer and Settle here to the
     landing site, Answer the call to the blink in the sky, Date the wreck to Mira's screen, Go into the light to the light;
   - Scan is one click: the glass sweeps the world, then each find (WorldFinds.js, 1 to 3: the places a team can go) is a
     steel label with a pin in the sky beside the world (a noun: no amber plate; only verbs keep the brackets, C24), its
     thread to its mark ON the world: what it is, its best prize and a clue toward
     our ship; a visited one says "done". The find GO DOWN goes to shows its ways instead (2026-11-02, the depth plan's step
     6), a row each: its short name, its prize, a risk word ("low risk", "risky", or where it can kill GO DOWN's red
     "death 1 in N"; the hurt chance is GO DOWN's), the way the team takes marked; a click on a row chooses that way
     (NSOrbit.way); a way a stress trait strikes says why ("Vance won't risk it.") and takes no click. They keep below the
     room A.U.R.A. speaks in under the title (two lines) while they fit there. A click on a find (its tag or its mark)
     makes it where GO DOWN goes: its mark in brackets, and the shuttle's path ends there (NSGlass.aim). Pointing at it shows that path;
   - the team's "GO DOWN" tag over the hatch (no names: they stand over the two heads; "one more" while a place is open, the
     label steel then; "hurt" when someone hurt goes; the
     risk where they go and, where the trip could kill, "death 1 in N" (NSOrbit.teamOdds): these odds are never dropped
     for want of room; "Go across" when the trip goes to a site in orbit, the wreckage, where nobody lands), and over each
     of the two at the hatch their first name in their colour and
     why they go;
   - "Leave orbit" as a lit key on Cora's console (it glows as the next step once nothing but settling is left; unlit, steel,
     with no chevrons and the reason as its chip while the team is down);
   - the note over someone pointed at: at the hatch whether they make this trip safer ("Safer with me." / "No help down
     there.") and what they really do for a trip; at the window "Aris goes instead of Vance", the same few words and what the
     ship loses while they are down; too weak, why;
   - the ship's stock on the wall left of the window (NSStock).
   A tag draws in from its corners, its label types on, its thread reaches out (80 ms apart, 125 ms steps); pointed at, it
   brightens, its thread turns solid with a pulse at the anchor, and the glass shows what it does (stop/TagArt.js).
   The keys (look pass B07): Tab and the arrows walk the tags, the finds and the console's keys (focus looks like pointing);
   Enter acts, and a held key is held with Enter (focusables()). A held key shows 7 ticks under its word, lit as it fills,
   and drains in 4 steps when let go early (Stop.js).
   At most 40 words on screen (the voice line counted): the world's name, the labels, the key and the stock first, then
   the chosen find's ways (whole, else each row's name and risk word; while A.U.R.A. says how to choose a way, at least each
   way's name), the kind line (hidden while A.U.R.A. speaks), the names at the hatch, the team's
   chips, whether people could live there, the other finds' chips, the actions' chips. Decided afresh only while nothing is pointed at: nothing moves under the pointer
   (but a click that chooses another find shows its chips at once, and a voice line that starts is budgeted again, the
   pointed row kept). Words never sit over the world's disc or a person. Settle here is cool grey, never warm.
   The first time an action shows, A.U.R.A. says once what it does (NSOrbit.TELL), one at a time, the pointed-at first; and
   once how to choose a find, and once how to choose its way (only where the ways' names fit beside her line).
   Loaded only when the new-screen switch is on, after stop/TagArt.js, stop/Tags.js and stop/FindWords.js, before stop/Stop.js.

   window.NSStopWords (frozen)
     findChips(find, hover?) → { chips } | { rows, lean }   what a find shows under its label (the headless checks read it too)
     create(ctx) → words     ctx from Stop.js: { S, css, unit, t0, poseOf, picking, team, need, arrived, joinedLast, isWrongPlace,
                             proposed, sweep() → ms into the scan's sweep | null, sprite(id), NAMES, TONE, CREW, OFFX, F,
                             HATCH, NAV, HELM } (frame px); S.finds: the world's finds (NewScreen.flow.finds)
     words.init(layer)       the tags and the stock in #ns-stop-words
     words.layout(t) → L     what shows where now (frame px), or null before the world has braked in
     words.glass(c, t, L)    what a pointed-at tag shows on the glass, and the scan's sweep (drawn under the room's frame)
     words.threads(c, t, L)  the threads and their pins, the finds' marks (under the people)
     words.tags(c, t, L)     shades, brackets, icons, the helm key (over everything)
     words.apply(t, L)       the DOM half: place, show, type on; A.U.R.A.'s first-time lines
     words.hide()            all off;  words.hit(cx, cy) → { kind: 'act' | 'leave' | 'who' | 'find' | 'way', key?, id?, idx?, struck? }
                             | null (CSS px; 'way': a way's row of the chosen find, idx its card index)
     words.fresh(key) → bool shown less than 400 ms ago (a click is ignored);  words.noteUp(), words.skyY() (frame y)
     words.focusables() → [{ key, hit }]  the tags the keys walk, in reading order (hit: as words.hit gives it)
     words.last() → L, words.fade(k)      the last layout (drawn on through the dive out) and the words' step fade with it
     words.debug() → [{ text, rect }]
*/
(function () {
    'use strict';
    const NS = window.NewScreen, GL = window.NSGlass, TA = window.NSTagArt, TG = window.NSTags, FW = window.NSFindWords;
    if (!NS || !NS.on || !GL || !TA || !TG || !FW) return;
    const WIN = GL.WIN, LIGHT = GL.LIGHT, SW = GL.SW;
    const MAX_LIT = 4, MAX_WORDS = 40, GUARD_MS = 400, TELL_AFTER_MS = 1500, STAGGER = 80, ARM_MS = 170, THREAD_MS = 280, GAP = 5;
    const WORTH = ['light', 'escape', 'accept', 'call', 'strange', 'date', 'team', 'dock', 'mine', 'settle', 'scan', 'skim'];   // more than 4: these first
    const NEAR_WORLD = ['world', 'station', 'field', 'giant', 'site', 'light'];
    const ICON = { scan: 'scan', team: 'shuttle', dock: 'clamp', mine: 'pick', skim: 'drop', strange: 'ring', call: 'wave', date: 'disc', settle: 'flag', light: 'light', escape: 'escape', accept: 'accept' };
    const { GOOD, FIT_LINE, WEAK_LINE, findChips } = FW;                  // the words tables (stop/FindWords.js)
    const DESK = [334, 429], KEY_Y = 290;                                 // Cora's console front (frame px): the helm key sits on it
    const KEY_TOP_TWO = 266;                                              // two held keys with their chips (the copy of Earth): the first one's top, so both fit the console
    const NOTE_MIN = 260;                                                 // CSS px: a person's note is never narrower (C56)
    const OFF_WHY = 'team away';                                          // DRAFT (look pass): Leave orbit's chip while the team is down
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
        let oddsKey = '', oddsVal = null, lastL = null;

        function init(el) {
            layer = el;
            T = { title: TG.make(layer, 'title'), acts: [0, 1, 2, 3].map(() => TG.make(layer, 'act')), go: TG.make(layer, 'act'), key: TG.make(layer, 'key'), settle: TG.make(layer, 'key'),
                who: [TG.make(layer, 'who'), TG.make(layer, 'who')], note: TG.make(layer, 'note'), probe: TG.make(layer, 'note'),
                titleProbe: TG.make(layer, 'title'),                     // never shown: the title with every row, measured (the room kept under it)
                finds: Array.from({ length: MAX_FINDS }, () => TG.make(layer, 'act')) };
            T.key.set({ label: 'Leave orbit' });
            T.settle.set({ label: 'Settle here' });
            stock = window.NSStock ? window.NSStock.board(layer) : null;
        }
        const allTags = () => [T.title, T.go, T.key, T.settle, T.note].concat(T.acts, T.who, T.finds);

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
                case 'strange': return [Math.round(clamp(dc[0] - dc[2] * 0.92, WIN.x0 + 6, WIN.x1 - 7)), Math.round(clamp(dc[1] + dc[2] * 0.62, WIN.y0 + 6, WIN.y1 - 7))];   // in space off the world's lower limb, kept on the glass
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
        /** The odds GO DOWN shows with ids going down (NSOrbit.teamOdds: { hurt, death, deadly, oneIn }), or null. */
        function teamOdds(ids) {
            const k = ids.join('+') + '@' + S.readAt;
            if (k !== oddsKey) { oddsKey = k; try { oddsVal = NS.flow && NS.flow.teamOdds ? NS.flow.teamOdds(ids) : null; } catch (err) { oddsVal = null; } }
            return oddsVal;
        }
        const need = () => (typeof ctx.need === 'function' ? ctx.need() : 2);   // two go down, or the one left who can go
        /** Who at the hatch is hurt (fewer than two were well, so the hurt may go: NSOrbit.pool). */
        function hurtIds() {
            try { return NS.game.crew().filter(c => c.hurt).map(c => c.id); } catch (err) { return []; }
        }
        function teamChips() {
            const ids = ctx.team(), out = [];                                 // no names: they stand over the two heads (look pass B07)
            if (ids.length < need()) out.push({ icon: 'slot', text: ids.length || need() < 2 ? 'one more' : 'two more', tone: 'open' });
            else {
                if (ids.some(id => hurtIds().includes(id))) out.push({ icon: 'help', text: 'hurt', tone: 'high', odds: true });   // DRAFT: someone hurt goes (riskier)
                const o = teamOdds(ids);
                if (o && o.hurt > 0) out.push({ icon: 'risk', text: `risk ${o.hurt}%`, tone: 'risk', odds: true });   // a 0 % risk says nothing
                if (o && o.deadly && o.oneIn) out.push({ icon: 'danger', text: `death 1 in ${o.oneIn}`, tone: 'high', odds: true });   // DRAFT: this trip could kill
            }
            return out;
        }
        const chipWords = list => (list || []).reduce((n, c) => n + wordsIn(c.text), 0);
        const rowWords = rows => (rows || []).reduce((n, r) => n + chipWords(r.chips), 0);
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
        /** Whether someone makes the trip safer (NSOrbit.helps: GO DOWN's odds with them, against the same trip without what
            they bring), as they say it when pointed at: "Safer with me." / "No help down there."; '' where a site's or Eden's
            own card says the odds. ids: the team they would be one of. Read once per read of the stop. */
        const fits = new Map();
        function fitLine(id, ids) {
            const k = `${id}|${ids.join('+')}@${S.readAt}`;
            if (!fits.has(k)) {
                if (fits.size > 40) fits.clear();
                let h = null;
                try { h = NS.flow && typeof NS.flow.helps === 'function' ? NS.flow.helps(ids, id) : null; } catch (err) { console.error('NewScreen stop: the fit failed', err); }
                fits.set(k, h == null ? '' : h ? FIT_LINE.yes : FIT_LINE.no);
            }
            return fits.get(k);
        }
        /** The note over someone pointed at (null: nobody fit to go or too weak is pointed at): at the hatch, whether they make
            it safer and what they really do (GOOD); at the window, who they would go instead of, then the same and what the
            ship loses without them. */
        function noteFor(id) {
            if (!id) return null;
            const tone = ctx.TONE[id], name = ctx.NAMES[id];
            if (S.aside.includes(id)) return { name, line: WEAK_LINE, loss: '', tone };
            if (!GOOD[id] || !S.lineup.includes(id)) return null;
            const pip = q => `<b style="--c:${ctx.TONE[q]}">${ctx.NAMES[q]}</b>`;   // a name in --text with a 6 px tone pip (C20b)
            const team = ctx.team();
            if (team.includes(id)) { const fit = fitLine(id, team); return fit ? { name, line: fit, loss: GOOD[id], tone } : { name, line: GOOD[id], loss: '', tone }; }
            const out = team.length >= 2 ? ctx.joinedLast() : null, mates = team.filter(q => q !== out);
            let loss = '';
            try { loss = (NS.flow && typeof NS.flow.lossOf === 'function' ? NS.flow.lossOf(id, mates) : '') || ''; } catch (err) { console.error('NewScreen stop: the loss failed', err); }
            const verb = goesAcross() ? 'goes across' : 'goes down';             // to the wreckage in orbit nobody lands
            const html = out ? `${pip(id)} goes instead of ${pip(out)}` : team.length ? `${pip(id)} goes with ${pip(team[0])}` : `${pip(id)} ${verb}`;
            const text = html.replace(/<[^>]+>/g, '');
            const rest = loss ? cap(loss) + '.' : `Nothing aboard needs ${id === 'aris' || id === 'mira' ? 'her' : 'him'} this time.`;
            return { html, text, loss: [fitLine(id, mates.concat(id)), rest].filter(Boolean).join(' '), tone };
        }

        // ── the words budget: at most 40 on screen (the voice line counted, unless a note has stepped it back). The world's
        //    name, the labels, the key, the stock and GO DOWN's odds (its hurt chance, "hurt", a death chance: a trip that could
        //    kill always says so before anyone goes) always; then, while they fit: the chosen find's ways, each row's name and
        //    risk word only (while A.U.R.A. says how to choose a way, TELL.way, and those do not fit beside her line: each way's
        //    name alone, GO DOWN's odds as she says; she says it only where those fit: wayRoom, explain()); the names at the
        //    hatch (both or neither) and the team's chips (who goes on the trip whose odds show);
        //    another find's "a clue" (a third find shows only for it: WorldFinds.js); the chosen find's rows whole (its prizes);
        //    the kind line, whether people could live there, the other finds' chips, each action's chips. Decided afresh only
        //    while nothing is pointed at: what is on screen holds still under the pointer (a click that chooses another find or
        //    another way is the one exception: the player asked to see it, and GO DOWN's odds change with it) ──
        let frozen = null;
        function decide(o) {
            const aimed = o.finds.find(f => f.target), aimedKey = aimed ? `${aimed.id}:${aimed.f ? aimed.f.way : ''}` : null;
            const voice = !o.note && NS.mods.voice && NS.mods.voice.current ? NS.mods.voice.current() : null, voiceKey = voice ? `${voice.who}|${voice.line}` : '';
            const pointed = !!(S.hot || S.hover), present = [o.acts.map(a => a.key), o.finds.map(f => f.id), o.team, o.leave, o.settle, (o.keys || []).map(a => a.key), o.note ? `${o.note.text || o.note.line}${o.note.loss}` : '', o.whoIds, !!o.kind, !!o.live].join('|');
            if (pointed && frozen && frozen.aimed === aimedKey && frozen.voice === voiceKey && frozen.present === present) return frozen;   // a click that chose another find or way, a line or a tag that came or went: decided once more
            const keep = pointed && frozen && aimed && aimed.rows && S.wayHover && S.wayHover.id === aimed.id ? frozen.find[aimed.id] : null;   // a line started while a way's row is pointed at: that row stays (EXTRA.md)
            const voiceWords = voice ? wordsIn(voice.who) + wordsIn(voice.line) : 0;
            let budget = MAX_WORDS - voiceWords;
            const take = n => { if (n <= 0) return true; if (budget - n >= 0) { budget -= n; return true; } return false; };
            o.acts.forEach(a => { budget -= wordsIn(a.words); });
            o.finds.forEach(f => { budget -= wordsIn(f.label); });
            if (o.team) budget -= 2;
            if (o.leave) budget -= 2 + (S.trip ? wordsIn(OFF_WHY) : 0);
            if (o.settle) budget -= wordsIn('Settle here');                              // its key on the console is on screen too
            (o.keys || []).forEach(a => { budget -= wordsIn(a.words); });
            if (o.stock) budget -= window.NSStock.KEYS.length * 2;                        // each readout: its number and its word
            if (o.name) budget -= wordsIn(o.name);
            if (o.note) budget -= wordsIn(o.note.name) + wordsIn(o.note.text || o.note.line) + wordsIn(o.note.loss);
            const odds = o.team ? o.goChips.filter(c => c.odds) : [];
            budget -= chipWords(odds);                                                       // GO DOWN's odds: always shown
            let stockLean = 0;                                                               // over 40 with only what must show: the stock's words step back (1), then its numbers (2), while it lasts
            while (o.stock && budget < 0 && stockLean < 2) { stockLean++; budget += window.NSStock.KEYS.length; }
            const dec = { act: {}, find: {}, keys: {}, aimed: aimedKey, voice: voiceKey, present, stockLean };
            (o.keys || []).forEach(a => { dec.keys[a.key] = take(chipWords([].concat(...(a.chips || []).map(c => (Array.isArray(c) ? c : [c]))))); });   // what a held key costs: first
            if (keep) { budget -= rowWords(keep === 'rows' ? aimed.rows : keep === 'names' ? aimed.names : aimed.lean); dec.find[aimed.id] = keep; }
            const leanWords = aimed && aimed.rows ? rowWords(aimed.lean) : 0, nameWords = aimed && aimed.names ? rowWords(aimed.names) : 0;
            const wayLine = String(((window.NSOrbit && window.NSOrbit.TELL) || {}).way || '').trim();
            const teaching = !!voice && !!wayLine && voice.line === wayLine;                // A.U.R.A. is saying how to choose a way (TELL.way)
            dec.wayRoom = !!(aimed && aimed.rows) && budget + voiceWords - wordsIn('A.U.R.A.') - wordsIn(wayLine) >= nameWords;   // were she to say it now, the names would fit
            if (keep) { /* kept as it was */ } else if (aimed && aimed.rows) dec.find[aimed.id] = take(leanWords) ? 'lean' : teaching && take(nameWords) ? 'names' : false;   // its ways, lean: the gamble first; while she teaches them, at least their names
            else if (aimed) dec.find[aimed.id] = take(chipWords(aimed.chips));
            dec.who = !!o.team && take(o.whoIds.reduce((n, id) => n + 1 + wordsIn(S.pick.why[id] || ''), 0));
            dec.go = !!o.team && take(chipWords(o.goChips.filter(c => !c.odds)));   // "one more" (the odds are counted above)
            o.finds.forEach(f => { if (f !== aimed && f.clue && !(f.id in dec.find) && take(wordsIn(f.clue.text))) dec.find[f.id] = 'clue'; });   // another find's clue
            if (aimed && dec.find[aimed.id] === 'lean' && take(rowWords(aimed.rows) - leanWords)) dec.find[aimed.id] = 'rows';   // its rows whole, prizes and all
            dec.kind = !!o.kind && !(voice && voice.who === 'A.U.R.A.') && take(wordsIn(o.kind));   // the kind line steps back while she speaks
            dec.facts = !!o.live && take(chipWords(o.live));
            o.finds.forEach(f => {
                if (!(f.id in dec.find)) dec.find[f.id] = take(chipWords(f.chips));
                else if (dec.find[f.id] === 'clue' && take(chipWords(f.chips) - wordsIn(f.clue.text))) dec.find[f.id] = true;   // its prize beside its clue
            });
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
            if (!noteHs.has(k)) { T.probe.set({ name: ctx.NAMES[id], line: FIT_LINE.no, loss: GOOD[id], wrap: Math.max(NOTE_MIN, Math.floor(HATCH_NOTE_WRAP * u)) + 'px' }); noteHs.set(k, T.probe.size(u)[1]); }   // the longer of its two first lines
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
            const scanning = !!(ctx.scanning && ctx.scanning());                 // the world not read yet, or just read: GO DOWN types on last, after the finds
            const teamAct = shown.find(a => a.team && picking && ctx.proposed() && !scanning) || null, acts = shown.filter(a => !a.team);
            // each action keeps its own tag while it stays on screen (a neighbour going never makes it draw in again)
            const used = new Set(), tagOf = new Map();
            acts.forEach(a => { const tg = T.acts.find(q => q.key0 === a.key); if (tg) { used.add(tg); tagOf.set(a.key, tg); } });
            acts.forEach(a => { if (tagOf.has(a.key)) return; const tg = T.acts.find(q => !used.has(q)); used.add(tg); tagOf.set(a.key, tg); });
            const L = { t, items: [], preview: null, stock: !NS.blocked() && !!stock, marks: [] };
            const leaveOn = !busy && !wrong, note = noteFor(S.hover), team = teamAct ? ctx.team() : [];
            const goChips = teamAct ? teamChips() : [], whoIds = team.filter(ctx.arrived);
            const nameText = S.node && !wrong ? titleCase(S.node.name || '') : '', kind = nameText ? kindLine() : '', live = nameText ? liveRow() : null;   // the copy has no name on the glass
            // the world's finds (WorldFinds.js): shown once the glass has swept it, never while the team is on its way
            const ground = g.kind === 'world' || g.kind === 'giant', allFinds = ground && !sweeping ? (S.finds || []).slice(0, MAX_FINDS) : [];
            const finds = busy ? [] : allFinds.map((f, i) => Object.assign({ f, id: f.id, label: f.label, target: !!f.target, tag: T.finds[i] }, findChips(f, S.wayHover && S.wayHover.id === f.id ? S.wayHover.idx : null)));
            if (busy) allFinds.filter(f => f.target).forEach(f => L.marks.push({ at: GL.spot(t, S.shownAt, f.at), state: 'target' }));   // where they are going stays marked
            const settleOn = !!settleAct && !busy && !wrong && !S.trip && homeable();   // Settle here, under Leave orbit (below)
            const dec = decide({ acts, finds, team: !!teamAct, leave: leaveOn, settle: settleOn, keys: busy ? [] : keyActs, stock: L.stock, note, goChips, whoIds, name: nameText, kind, live });
            L.wayRoom = !!dec.wayRoom;                                       // A.U.R.A. tells how to choose a way only when its names stay beside her line (explain)
            L.stockLean = dec.stockLean || 0;

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
                const item = { key: a.key, tag: tagOf.get(a.key), kind: 'act', x, y, w, h, tone: a.key === 'settle' ? 'cool' : 'warm', icon: ICON[a.key], brackets: true };   // a verb: warm (Fly closer's ring on the glass is steel, TagArt)
                item.anchor = anchorOf(a, g, dc, site, [x, y, w, h]);
                item.thread = item.anchor ? threadTo([x, y, w, h], item.anchor) : null;
                L.items.push(item); boxes.push([x, y, w, h]);
            };
            /** A find's label (kind 'find'): steel, a pin, no plate (C24), its thread to its mark ON the world; a visited one dimmed. */
            const addFind = (v, x, y, w, h, at) => {
                const item = { key: 'find:' + v.id, id: v.id, tag: v.tag, kind: 'find', x, y, w, h, tone: 'cool', icon: 'pin', brackets: false,
                    dim: !!v.f.done, target: v.target, at: v.f.at, anchor: at.map(Math.round), rowWays: v.shownRows ? v.shownRows.map(r => (r.idx == null ? null : { idx: r.idx, struck: !!r.struck })) : null };   // rowWays: each row's way (a click chooses it)
                item.thread = threadTo([x, y, w, h], item.anchor);
                L.items.push(item); boxes.push([x, y, w, h]);
            };
            const sized = acts.map(a => { const tg = tagOf.get(a.key); tg.set({ label: a.words, chips: dec.act[a.key] ? a.chips : null }); return tg.size(u); });
            const stack = acts.filter(a => NEAR_WORLD.includes(a.near) || a.near === 'call' || (a.near === 'under' && !wrong))   // the call too: last, its thread runs down to the blink
                .sort((a, b) => (a.near === 'call') - (b.near === 'call'));
            // the finds first, in the order of their marks (top to bottom: no thread crosses another), each level with its mark
            // where it can be; the actions under them (or, with no finds, starting by the landing site as before)
            const column = finds.map(v => {
                v.shownRows = v.rows ? (dec.find[v.id] === 'rows' ? v.rows : dec.find[v.id] === 'lean' ? v.lean : dec.find[v.id] === 'names' ? v.names : null) : null;   // the chosen find's ways, whole, lean or their names
                v.tag.set({ label: v.label, rows: v.shownRows, chips: !v.rows && dec.find[v.id] ? (dec.find[v.id] === 'clue' ? [v.clue] : v.chips) : null });
                const [w, h] = v.tag.size(u); return { v, w, h, at: GL.spot(t, S.shownAt, v.f.at) };
            })
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
                y = Math.min(y, WIN.y1 - (a.near === 'mira' ? 4 : 22) - h);   // never down among the heads at the window; Mira's stays on the glass
                while (onDisc([x, y, w, h], dc, 4) && x < WIN.x1 - w - 4 && a.near === 'mira') x += 2;
                add(a, clamp(x, a.near === 'mira' ? WIN.x0 + 4 : 4, a.near === 'mira' ? WIN.x1 - 4 - w : SW - w - 4), y, w, h);
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
                const goShown = dec.go ? goChips : goChips.filter(c => c.odds);   // GO DOWN's odds are never dropped
                T.go.set({ label: goesAcross() ? 'Go across' : 'Go down', chips: goShown.length ? goShown : null });   // DRAFT 'Go across': to the wreckage in orbit, nobody lands
                const heads = team.map(id => headTop(id)).concat(team.length ? [] : [headTop('vance')]);
                const [w, h] = T.go.size(u), top = Math.min(...heads) - 4 - Math.max(room, 18) - 7 - h;
                const go = { key: 'team', tag: T.go, kind: 'act', x: 34, y: top, w, h, tone: team.length < need() ? 'cool' : 'warm', icon: ICON.team, brackets: true, dim: team.length < need() };   // a place open: steel
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
                const off = !!S.trip;                                     // the team is down: unlit, steel, no chevrons, the reason as its chip
                T.key.set({ label: 'Leave orbit', chips: off ? [{ text: OFF_WHY, tone: 'off' }] : null });
                const [w, h] = T.key.size(u), next = !off && !acts.length && !teamAct && !finds.some(v => !v.f.done);
                L.items.push({ key: 'leave', tag: T.key, kind: 'key', x: deskX(w), y: Math.round(KEY_Y - h / 2), w, h, next, off, tone: off ? 'cool' : 'warm' });
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
            if (settleOn) {
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
            // the copy of Earth: no marks over their heads (C04); A.U.R.A. says how the fall left them (stop/Copy.js)
            // the note over someone pointed at: at the hatch it takes the place of their name, under GO DOWN; always on the glass (C56)
            if (note) {
                const atHatch = notedBox === true;
                T.note.set({ name: note.html ? '' : note.name, line: note.line, html: note.html, loss: note.loss, tone: note.tone, wrap: Math.max(NOTE_MIN, Math.floor((atHatch ? HATCH_NOTE_WRAP : 118) * u)) + 'px' });
                const [w, h] = T.note.size(u), p = ctx.poseOf(S.hover, t);
                notedBox = null;
                if (p && !p.hidden) {
                    let x = clamp(Math.round(p.x + ctx.OFFX - w / 2), WIN.x0 + 4, WIN.x1 - 4 - w);
                    const y = Math.max(WIN.y0 + 4, headTop(S.hover) - 6 - h);
                    while (onDisc([x, y, w, h], dc, 6) && x > WIN.x0 + 4) x -= 4;
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
                if (sweep != null) { const g = GL.geom(t, S.shownAt), dc = GL.disc(t, S.shownAt) || [g.x, g.y, g.r]; TA.preview(c, 'scan', { disc: [dc[0], dc[1], g.kind === 'world' ? g.r : dc[2]], t: sweep, still: false, ping: ctx.sweepPing ? ctx.sweepPing() : null }); }   // a click meanwhile: its pin flashes once
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
            const calm = still();                                         // the stock is lit stencil on the wall plate: no box round it (C27)
            L.items.forEach(it => {
                const k = calm ? 1 : clamp01(since(it, t) / ARM_MS), hot = S.hot === it.key, lit = hot || !!it.target;   // the find chosen stays lit
                if (it.kind === 'key') {
                    const cool = it.tone === 'cool', held = it.hold != null;   // a held key: its 7 ticks under its word
                    TA.key(c, it.x, it.y, it.w, it.h, { hot, next: it.next, off: it.off, t, still: calm, tone: it.tone, fill: it.hold || 0, fillH: it.tag.lh || 0, ticks: held ? 7 : 0 });
                    if (!it.off) TA.icon(c, it.icon || (cool ? 'flag' : 'chevrons'), it.x + 4, it.y + (it.h > 16 ? 3 : Math.floor((it.h - 9) / 2)), cool ? 'cool' : 'warm', hot || it.next ? 1 : 0);   // with chips: level with its word; off: no chevrons
                    return;
                }
                TA.shade(c, it.x, it.y, it.w, it.h, Math.min(1, k * 1.6));
                if (it.brackets || (it.kind === 'find' && hot)) TA.brackets(c, it.x, it.y, it.w, it.h, it.tone, k, lit);   // a find: steel brackets only while pointed at (or focused)
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
                tag.flag('is-find', it.kind === 'find');
                tag.flag('is-off', !!it.off);
                tag.type(now, calm);
            });
            allTags().forEach(tag => { if (!on.has(tag)) { if (tag.on && tag.key0) { drawnAt.delete(tag.key0); shownWall.delete(tag.key0); } tag.show(false); tag.key0 = null; } });
            if (stock) { if (L.stock) placeStock(); else stock.hide(); }
            layer.classList.toggle('is-stock-lean', L.stockLean >= 1);
            layer.classList.toggle('is-stock-gone', L.stockLean >= 2);
            explain();
        }
        function hide() {
            if (!T) return;
            allTags().forEach(tag => { tag.show(false); tag.key0 = null; });
            drawnAt.clear(); shownWall.clear();
            if (stock) stock.hide();
            if (layer) layer.style.opacity = '';
            lastL = null; frozen = null;
        }
        /** The dive out: the words fade in the bridge's own 8 steps, with their plates (one step group). */
        function fade(k) { if (layer) layer.style.opacity = k >= 1 ? '' : String(Math.max(0, Math.round(k * 8) / 8)); }
        /** The ship's stock on the wall left of the window, one under another, right-aligned to the window's frame: lit stencil
            readouts on the wall plate, no box round them (C27; the look is Tags.js's #ns-stop-words .nss). */
        function placeStock() {
            const [x, y] = ctx.css(WIN.x0 - 12, WIN.y0 + 30), gap = 11 * ctx.unit();
            window.NSStock.KEYS.forEach((k, i) => stock.put(k, x, y + i * gap, 'right'));
        }
        /** The pointer (CSS px) on an item's box (its frame px box, as placed: no layout is read). */
        function inside(it, cx, cy, pad) {
            const [x, y] = ctx.css(it.x, it.y), u = ctx.unit();
            return cx >= x - pad && cx <= x + it.w * u + pad && cy >= y - pad && cy <= y + it.h * u + pad;
        }
        /** What a click on an item is (null: it takes none): a held or helm key, a find, an action, a name at the hatch. */
        function hitOf(it) {
            if (it.kind === 'key') return it.off ? null : { kind: it.key === 'settle' || it.key === 'accept' ? 'settle' : it.key === 'escape' ? 'fight' : 'leave', key: it.key };
            if (it.kind === 'who') return { kind: 'who', id: it.id };
            if (it.kind === 'find') return it.dim ? null : { kind: 'find', id: it.id, key: it.key };   // a visited find takes no click
            return it.kind === 'act' ? { kind: 'act', key: it.key } : null;
        }
        function hit(cx, cy) {
            if (!lastL) return null;
            for (const it of lastL.items) {
                if (!it.tag.on || it.kind === 'title' || it.kind === 'note' || !inside(it, cx, cy, it.kind === 'who' ? 2 : 6)) continue;
                const h = hitOf(it);
                if (!h) continue;
                return it.kind === 'find' ? wayAt(it, cy) || h : h;      // a way's row chooses that way
            }
            const [ox, oy] = ctx.css(0, 0), u = ctx.unit(), fx = (cx - ox) / u, fy = (cy - oy) / u;   // a find's mark on the world takes a click too
            const m = lastL.items.find(it => it.kind === 'find' && it.tag.on && !it.dim && Math.hypot(it.anchor[0] - fx, it.anchor[1] - fy) <= MARK_HIT);
            return m ? { kind: 'find', id: m.id, key: m.key } : null;
        }
        /** The way's row of the chosen find under the pointer (CSS y): { kind: 'way', id, idx: the card's index, struck, key: the
            find's tag } (its rows as last measured: Tags.js rowsAt), or null: not on a way's row. */
        function wayAt(it, cy) {
            if (!it.rowWays || !it.tag.rowsAt) return null;
            const fy = (cy - ctx.css(it.x, it.y)[1]) / ctx.unit();
            const k = it.tag.rowsAt.findIndex(([top, h]) => fy >= top - 1 && fy <= top + h + 1);
            const w = k >= 0 ? it.rowWays[k] : null;
            return w ? { kind: 'way', id: it.id, idx: w.idx, struck: w.struck, key: it.key } : null;
        }
        const fresh = key => performance.now() - (shownWall.get(key) || 0) < GUARD_MS;
        /** The tags the keys walk (Tab, the arrows), in reading order: the glass top to bottom, GO DOWN, the console's keys. */
        function focusables() {
            return lastL ? lastL.items.filter(it => it.tag.on && it.kind !== 'who').map(it => ({ key: it.key, hit: hitOf(it) })).filter(f => f.hit) : [];
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
            const isWays = it => isFind(it) && (it.rowWays || []).filter(w => w && !w.struck).length >= 2;   // a find whose ways can be chosen ('way')
            const shown = lastL.items.filter(it => (it.kind === 'act' || it.kind === 'key') && !it.off && seen(it) && ready(it.key) && !(copy && (it.key === 'scan' || (CPY && CPY.used(it.key))))).map(it => it.key)   // the copy: A.U.R.A.'s scan line is its own; a key pressed needs no telling
                .concat(lastL.items.some(it => isFind(it) && seen(it)) ? ['find'] : [])
                .concat(lastL.wayRoom && lastL.items.some(it => isWays(it) && seen(it)) ? ['way'] : []);   // only while the ways' names would stay beside her line
            const key = (S.hot && shown.includes(S.hot) ? [S.hot] : []).concat(shown).find(k => tell[k] && !v.told('act:' + k));
            if (!key) return;
            telling = true;
            const text = String(tell[key]).replace('{team}', team.map(id => ctx.NAMES[id]).join(' and '));
            const done = () => { telling = false; };
            const stillThere = () => S.open && !S.dive && !!lastL && lastL.items.some(it => (key === 'find' ? isFind(it) : key === 'way' ? isWays(it) : it.key === key) && it.tag.on) && ready(key)
                && (key !== 'way' || lastL.wayRoom);
            v.once('act:' + key, text, stillThere).then(done, err => { done(); console.error('NewScreen stop: the voice failed', err); });
        }
        const debug = () => (T ? allTags().filter(tag => tag.on).map(tag => ({ key: tag.key0, text: tag.el.textContent, rect: (r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])(tag.el.getBoundingClientRect()) })) : []);
        return { init, layout, glass, threads, tags, apply, hide, hit, fresh, noteUp: () => !!(T && T.note.on), skyY, focusables, last: () => lastL, fade, debug };
    }

    window.NSStopWords = Object.freeze({ create, findChips });
})();
