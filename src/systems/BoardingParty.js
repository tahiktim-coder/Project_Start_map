/* BoardingParty — one crew member walks through an old station on one tank of air.
   First the ship docks (DockingGame.js): a rough docking costs the boarder 2 air, a hard one 3.
   The station is a small branching map: the airlock, corridors that split, and rooms worth the trip —
   stores, power room, med bay, crew deck, cryo bay — with the command deck, and the station's story, at the far end.
   Every door and every search shows its air cost before you click. The air bar marks what the walk back out costs
   from where you stand, carrying what you carry. Heavy things (an energy cell, a sleeper pod) add 1 air to every
   room on the way back, and there are only three hands. So each room asks: take this, or go deeper for something better?
   Rooms can be DARK (searching costs more), VENTED (walking in costs more), UNSTABLE (a shown chance of getting hurt
   when you search) or SEALED (cutting in costs air). At most one small surprise per station.
   A move that would leave too little air to walk out is refused, so following the shown costs always gets you home.
   "LET A.U.R.A. GUIDE" walks a safe plan for you.
   THE LOOK (2026-10-11): the redrawn minigames' (src/systems/minigames: the frame of minigames.css, the art kit in art/).
   The station is cut away like the living ship's decks, our Lander docked at its airlock, the boarder a crew-hires person
   in an EVA suit; the doors are quiet labels on the picture, the air and the hands two small mono readouts, what happens
   the voice line, the choices plain words. Its dark backdrop goes up under the docking camera, so nothing shows between the
   two. The rules, rooms, choices, texts, air costs and results are the same as before.
   start(app, station) → Promise<{ reachedCommand: boolean, member }>     ageOf(station, sector) → years
   The rules below never touch the page, so they can be simulated headless (see `internals`). */

(function () {
    'use strict';

    // ── the rules ──
    const TANK = 16, MEDIC_EXTRA_AIR = 2, HANDS = 3;
    const STEP_COST = 1, HEAVY_STEP_COST = 1, VENT_EXTRA = 1, SEARCH_COST = 2, DARK_EXTRA = 1;
    const CUT_COST = 3, ENGINEER_CUT_COST = 1, JAM_COST = 2, RECORD_COST = 1, POCKET_AIR = 2;
    const RISK_BASE = 0.2, RISK_PER_SECTOR = 0.03;                  // chance of getting hurt searching an UNSTABLE room
    const CONDITIONS_BY_SECTOR = [2, 2, 2, 3, 3, 4, 4];              // index = sector: older stations are in worse shape
    const SURPRISE_CHANCE = 0.6, LOOP_CHANCE = 0.5, DEPTH_BONUS = 0.2; // DEPTH_BONUS: each room deeper holds 20% more
    const DOCK_AIR_LOSS = { soft: 0, rough: 2, crash: 3 };
    const AURA_RESERVE = 1;                                          // A.U.R.A. always keeps one spare air on top of the walk out
    const PLAN_VALUE = { command: 60, injury: 30, name: 5, airLeft: 0.1 }; // how the headless "good plan" scores a run
    const SECTOR_AGE_YEARS = [20, 20, 20, 100, 200, 300, 400];      // index = sector; matches the table in docs/CANON.md
    const HULL_RANGE = [[1, 8], [1, 8], [1, 8], [212, 980], [1400, 6000], [9000, 22000], [30000, 41000]];

    // Four station plans on a 4 × 3 grid of [column, row]. Room 0 is the airlock; `command` is the far end. `loops` are extra doors, each open half the time.
    const PLANS = [
        { cells: [[0, 1], [1, 1], [1, 0], [1, 2], [2, 1], [2, 0], [2, 2], [3, 1]], doors: [[0, 1], [1, 2], [1, 3], [1, 4], [4, 5], [4, 6], [4, 7]], loops: [[2, 5], [3, 6]], command: 7 },
        { cells: [[0, 1], [1, 1], [1, 0], [2, 0], [3, 0], [1, 2], [2, 2]], doors: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6]], loops: [], command: 4 },
        { cells: [[0, 1], [1, 1], [2, 1], [1, 0], [2, 0], [1, 2], [2, 2], [3, 2]], doors: [[0, 1], [1, 2], [1, 3], [1, 5], [2, 4], [2, 6], [6, 7]], loops: [[3, 4]], command: 7 },
        { cells: [[0, 1], [1, 1], [1, 0], [2, 0], [1, 2], [2, 2], [2, 1]], doors: [[0, 1], [1, 2], [2, 3], [3, 6], [1, 4], [4, 5], [5, 6]], loops: [], command: 6 },
    ];
    const CORE_ROOMS = ['STORES', 'POWER', 'MEDBAY', 'CREW', 'CRYO'], SPARE_ROOMS = ['LAB', 'CORRIDOR'];
    const ROOMS = {
        AIRLOCK: { name: 'AIRLOCK', text: 'Your way in, and your only way out.' },
        CORRIDOR: { name: 'CORRIDOR', text: 'Loose cables drift in the dark.' },
        STORES: { name: 'STORES', text: 'Shelves of sealed crates.' },
        POWER: { name: 'POWER ROOM', text: 'The batteries still hold a charge.' },
        MEDBAY: { name: 'MED BAY', text: 'Two beds and a locked cabinet.' },
        CREW: { name: 'CREW DECK', text: 'Bunks. Somebody lived here.' },
        CRYO: { name: 'CRYO BAY', text: 'One pod is still running. Someone is asleep inside.' },
        LAB: { name: 'LAB', text: 'Instruments still blinking on backup power.' },
        COMMAND: { name: 'COMMAND', text: "The station's logs are kept here." },
    };
    const PERKS = {
        LEADER: { text: 'No special skill. When you come back, the whole crew calms down.' },
        ENGINEER: { text: `Cuts through sealed doors for ${ENGINEER_CUT_COST} air instead of ${CUT_COST}.` },
        MEDIC: { text: `Breathes slowly. Starts with ${MEDIC_EXTRA_AIR} more air.`, air: MEDIC_EXTRA_AIR },
        SECURITY: { text: 'Armoured suit. The first injury does nothing.' },
        SPECIALIST: { text: 'Carries the scanner. Sees what is in the next rooms, and dark rooms cost her nothing extra.' },
    };
    const QUARTERS_LOGS = [ // [max age in years, lines] — first bracket that fits the station's age
        [60, ['"Day 212. Still no reply from Earth. They said the radio would work."', '"We found a dead ship of our own class today. Nobody wants to talk about it."']],
        [160, ['"They told us we were the ninth on this heading. We passed forty wrecks before breakfast."', '"The mission patch in locker 3 has a number on it. A very big number."']],
        [260, ['"The ship keeps steering us. Nobody set this course."', '"It is not a planet we are looking for. I am sure of that now."']],
        [9999, ['"We stopped chasing it. We are going to build something it cannot miss."', '"If you are reading this, you were faster than us. Good. Keep going, or don\'t."']],
    ];
    const WALL_NAMES = ['R. Okafor', 'L. Brandt', 'S. Ito', 'M. Duarte', 'J. Keane', 'T. Haldane', 'P. Mensah', 'E. Lindqvist', 'D. Reyes', 'H. Sato'];

    const has = (mask, id) => ((mask >> id) & 1) === 1;
    const add = (mask, id) => mask | (1 << id);
    const doorKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    const between = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
    const pickOne = (rand, list) => list[Math.floor(rand() * list.length)];
    const hasItem = key => typeof ITEMS !== 'undefined' && !!ITEMS[key];
    const hullLabel = (sector, n) => (sector <= 2 ? `EXODUS-${n}` : `hull ${n.toLocaleString('en-US')}`);

    function seeded(id) {
        let s = 7;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }
    function shuffled(list, rand) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
        return out;
    }

    /** How long ago this station went quiet. Fixed per station; older in deeper sectors. */
    function ageOf(station, sector) {
        const base = SECTOR_AGE_YEARS[Math.max(1, Math.min(6, sector || 1))];
        return Math.round(base * (0.85 + seeded(station && station.id)() * 0.3));
    }

    /** What a room holds. `value` only steers the headless planners; `hands` 0 means it goes in a pocket. */
    function makeFind(type, depth, rand, age) {
        const more = 1 + DEPTH_BONUS * (depth - 1), grow = (lo, hi) => Math.round(between(rand, lo, hi) * more);
        switch (type) {
            case 'STORES': { const n = grow(10, 18); return { kind: 'salvage', amount: n, hands: 1, heavy: false, name: 'salvage crates', gain: `+${n} salvage`, value: n }; }
            case 'POWER': { const n = grow(10, 16); return { kind: 'energy', amount: n, hands: 1, heavy: true, name: 'an energy cell', gain: `+${n} energy`, value: n * 1.5 }; }
            case 'MEDBAY': return hasItem('MEDKIT') ? { kind: 'medkit', hands: 1, heavy: false, name: 'a sealed medkit', gain: 'heals one injured crew member', value: 25 }
                : { kind: 'salvage', amount: 8, hands: 1, heavy: false, name: 'medical supplies', gain: '+8 salvage', value: 8 };
            case 'CREW': { const lines = QUARTERS_LOGS.find(([maxAge]) => age <= maxAge)[1]; return { kind: 'diary', hands: 0, heavy: false, name: 'a diary', gain: 'the crew will want to read it', note: pickOne(rand, lines), value: 8 }; }
            case 'CRYO': return { kind: 'pod', hands: 2, heavy: true, name: 'the sleeper pod', gain: 'someone alive, for the hold', value: 40 };
            case 'LAB': return rand() < 0.35 && hasItem('TECH_FRAGMENT') ? { kind: 'tech', hands: 1, heavy: false, name: 'a piece of working tech', gain: 'goes in the cargo hold', value: 30 }
                : { kind: 'data', amount: 1, hands: 0, heavy: false, name: 'research notes', gain: '+1 data', value: 15 };
            case 'CORRIDOR': { if (rand() < 0.5) return null; const n = between(rand, 4, 8); return { kind: 'salvage', amount: n, hands: 1, heavy: false, name: 'scrap in a wall panel', gain: `+${n} salvage`, value: n }; }
            case 'COMMAND': { const n = between(rand, 18, 30); return { kind: 'salvage', amount: n, hands: 1, heavy: false, name: 'parts from the station core', gain: `+${n} salvage`, value: n }; }
            default: return null;
        }
    }

    /** One station, fixed by its id: rooms on the grid, doors between them, conditions, finds and at most one surprise. */
    function buildStation({ seed, sector = 1, age = 20 }) {
        const rand = seeded(`${seed}:plan`), plan = pickOne(rand, PLANS), isFlipped = rand() < 0.5;
        const doors = plan.doors.concat(plan.loops.filter(() => rand() < LOOP_CHANCE));
        const rooms = plan.cells.map(([col, row], id) => ({ id, col, row: isFlipped ? 2 - row : row, type: null, cond: null, find: null, depth: 0 }));
        const adj = rooms.map(() => []);
        doors.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
        rooms[0].type = 'AIRLOCK'; rooms[plan.command].type = 'COMMAND';
        const pool = shuffled(CORE_ROOMS, rand).concat(shuffled(SPARE_ROOMS, rand));
        rooms.filter(r => !r.type).forEach((r, i) => { r.type = pool[i]; });
        const queue = [0], seen = new Set([0]);                      // depth = doors from the airlock
        while (queue.length) { const id = queue.shift(); adj[id].forEach(n => { if (!seen.has(n)) { seen.add(n); rooms[n].depth = rooms[id].depth + 1; queue.push(n); } }); }
        rooms.forEach(r => { r.find = makeFind(r.type, r.depth, rand, age); });
        const conds = ['DARK', 'VENTED', 'UNSTABLE', 'SEALED'], count = CONDITIONS_BY_SECTOR[Math.max(1, Math.min(6, sector))];
        shuffled(rooms.slice(1), rand).slice(0, count).forEach(r => { r.cond = pickOne(rand, conds); });
        const L = { rooms, adj, command: plan.command, sector, risk: Math.round((RISK_BASE + RISK_PER_SECTOR * (sector - 1)) * 20) / 20, jam: null, pocketRoom: -1, nameRoom: -1, wallName: '' };
        if (rand() < SURPRISE_CHANCE) {
            const kind = pickOne(rand, ['pocket', 'jam', 'name']), inner = rooms.slice(1);
            if (kind === 'pocket') L.pocketRoom = pickOne(rand, inner).id;
            if (kind === 'name') { const range = HULL_RANGE[Math.max(1, Math.min(6, sector))]; L.nameRoom = pickOne(rand, inner).id; L.wallName = `${pickOne(rand, WALL_NAMES)}, ${hullLabel(sector, between(rand, range[0], range[1]))}`; }
            if (kind === 'jam') { const deep = doors.filter(([a, b]) => a !== 0 && b !== 0 && a !== 1 && b !== 1); if (deep.length) L.jam = doorKey(...pickOne(rand, deep)); }
        }
        return L;
    }

    // ── one boarder's run: plain objects, never changed in place (every action returns a new one) ──
    const handsUsed = b => b.haul.reduce((sum, f) => sum + f.hands, 0);
    const heavyCount = b => b.haul.filter(f => f.heavy).length;
    const cutCost = b => (b.role === 'ENGINEER' ? ENGINEER_CUT_COST : CUT_COST);

    /** What the boarder can see: rooms they have been in, and the doors of the rooms next to those (conditions, not contents). A deep scan shows everything. */
    function reveal(L, b) {
        if (b.isScanned) { const all = (1 << L.rooms.length) - 1; return { ...b, seen: all, known: all }; }
        let seen = b.seen, known = b.known;
        L.rooms.forEach(r => {
            if (!has(b.visited, r.id)) return;
            seen = add(seen, r.id); known = add(known, r.id);
            L.adj[r.id].forEach(n => { seen = add(seen, n); if (b.role === 'SPECIALIST') known = add(known, n); });
        });
        return { ...b, seen, known };
    }

    function newRun(L, { role = null, air = TANK, isScanned = false } = {}) {
        return reveal(L, { pos: 0, air, airMax: air, role, isScanned, haul: [], visited: 1, seen: 0, known: 0, cut: 0, taken: 0, isForced: false, isRecorded: false, isPocketUsed: false, isHurt: false, isArmourSpent: false, reachedCommand: false });
    }

    /** Air to walk from `from` into the next room `to`, carrying what b carries. */
    function enterCost(L, b, from, to) {
        const room = L.rooms[to];
        let cost = STEP_COST + heavyCount(b) * HEAVY_STEP_COST;
        if (room.cond === 'VENTED') cost += VENT_EXTRA;
        if (room.cond === 'SEALED' && !has(b.cut, to)) cost += cutCost(b);
        if (L.jam === doorKey(from, to) && !b.isForced) cost += JAM_COST;
        return cost;
    }

    /** The cheapest way back to the airlock through rooms already walked, carrying what b carries. */
    function homeRoute(L, b) {
        const n = L.rooms.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
        dist[b.pos] = 0;
        for (;;) {
            let u = -1;
            for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
            if (u < 0 || u === 0) break;
            done[u] = true;
            L.adj[u].forEach(v => { if (!has(b.visited, v)) return; const d = dist[u] + enterCost(L, b, u, v); if (d < dist[v]) { dist[v] = d; prev[v] = u; } });
        }
        const path = [];
        for (let v = 0; v !== b.pos && v >= 0; v = prev[v]) path.unshift(v);
        return { cost: dist[0], path };
    }

    function moveTo(L, b, to) {
        const room = L.rooms[to];
        return reveal(L, {
            ...b, pos: to, air: b.air - enterCost(L, b, b.pos, to), visited: add(b.visited, to),
            cut: room.cond === 'SEALED' ? add(b.cut, to) : b.cut, isForced: b.isForced || L.jam === doorKey(b.pos, to),
            reachedCommand: b.reachedCommand || to === L.command,
        });
    }
    const takeCost = (L, b) => SEARCH_COST + (L.rooms[b.pos].cond === 'DARK' && b.role !== 'SPECIALIST' ? DARK_EXTRA : 0);
    const takeHere = (L, b) => ({ ...b, air: b.air - takeCost(L, b), haul: b.haul.concat([L.rooms[b.pos].find]), taken: add(b.taken, b.pos) });

    /** Everything the boarder can do from here, each with its air cost and whether it still leaves enough air to walk out. */
    function options(L, b) {
        const home = homeRoute(L, b), list = [];
        L.adj[b.pos].forEach(to => {
            const next = moveTo(L, b, to), homeAfter = homeRoute(L, next).cost;
            list.push({ kind: 'move', to, cost: b.air - next.air, homeAfter, isSafe: next.air >= homeAfter, isHomeward: to === home.path[0] });
        });
        const find = L.rooms[b.pos].find;
        if (find && !has(b.taken, b.pos)) {
            const next = takeHere(L, b), homeAfter = homeRoute(L, next).cost, isFull = handsUsed(b) + find.hands > HANDS;
            list.push({ kind: 'take', find, cost: takeCost(L, b), homeAfter, risk: L.rooms[b.pos].cond === 'UNSTABLE' ? L.risk : 0, isFull, isSafe: !isFull && next.air >= homeAfter });
        }
        if (L.nameRoom === b.pos && !b.isRecorded) list.push({ kind: 'record', cost: RECORD_COST, homeAfter: home.cost, isSafe: b.air - RECORD_COST >= home.cost });
        if (b.pos === 0) list.push({ kind: 'leave', cost: 0, homeAfter: 0, isSafe: true });
        return { list, home };
    }

    /** Do one action. rand() decides only the injury roll. Returns the new run and what happened, for the screen to put into words. */
    function apply(L, b, action, rand) {
        const events = {};
        if (action.kind === 'move') {
            events.wasSealed = L.rooms[action.to].cond === 'SEALED' && !has(b.cut, action.to);
            events.wasJammed = L.jam === doorKey(b.pos, action.to) && !b.isForced;
            let next = moveTo(L, b, action.to);
            if (L.pocketRoom === action.to && !next.isPocketUsed) { next = { ...next, air: next.air + POCKET_AIR, isPocketUsed: true }; events.pocket = true; }
            events.isFirstVisit = !has(b.visited, action.to);
            return { next, events };
        }
        if (action.kind === 'take') {
            let next = takeHere(L, b);
            if (L.rooms[b.pos].cond === 'UNSTABLE' && rand() < L.risk) {
                if (b.role === 'SECURITY' && !b.isArmourSpent) { next = { ...next, isArmourSpent: true }; events.armour = true; }
                else { next = { ...next, isHurt: true }; events.hurt = true; }
            }
            return { next, events };
        }
        if (action.kind === 'record') return { next: { ...b, air: b.air - RECORD_COST, isRecorded: true, wallName: L.wallName }, events };
        return { next: { ...b, isDone: true }, events };
    }

    // ── A.U.R.A.'s plan: command deck first, then the nearest room she can still afford; safe rooms only; heavy things only on the way out ──
    /** Walk to `target` through rooms already walked (or any room, with a scan), and say whether the trip still leaves enough to get out, plus a spare. */
    function tripTo(L, b, target) {
        const n = L.rooms.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
        const isOpen = id => id === target || has(b.visited, id) || b.isScanned;
        dist[b.pos] = 0;
        for (;;) {
            let u = -1;
            for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
            if (u < 0 || u === target) break;
            done[u] = true;
            L.adj[u].forEach(v => { if (!isOpen(v)) return; const d = dist[u] + enterCost(L, b, u, v); if (d < dist[v]) { dist[v] = d; prev[v] = u; } });
        }
        if (dist[target] === Infinity) return null;
        const path = [];
        for (let v = target; v !== b.pos; v = prev[v]) path.unshift(v);
        let s = b, isEveryStepSafe = true;                                // each room on the way must still leave enough to get out, not just the last
        path.forEach(id => { s = moveTo(L, s, id); if (s.air < homeRoute(L, s).cost) isEveryStepSafe = false; });
        return { path, cost: dist[target], isAffordable: isEveryStepSafe && s.air >= homeRoute(L, s).cost + AURA_RESERVE };
    }

    function auraTarget(L, b) {
        const unvisited = L.rooms.filter(r => !has(b.visited, r.id) && has(b.seen, r.id));
        const trips = unvisited.map(r => ({ id: r.id, trip: tripTo(L, b, r.id) })).filter(t => t.trip && t.trip.isAffordable);
        const command = trips.find(t => t.id === L.command);
        if (command) return command;
        return trips.sort((x, y) => x.trip.cost - y.trip.cost)[0] || null;
    }

    function auraAction(L, b) {
        const { list, home } = options(L, b), target = auraTarget(L, b), isGoingOut = !target;
        const spare = o => o.isSafe && b.air - o.cost >= o.homeAfter + AURA_RESERVE;
        const keepsCommand = next => b.reachedCommand || !has(next.seen, L.command) || (tripTo(L, next, L.command) || {}).isAffordable;
        const take = list.find(o => o.kind === 'take');
        if (take && !take.risk && spare(take) && (isGoingOut || !take.find.heavy) && keepsCommand(takeHere(L, b))) return take;
        const record = list.find(o => o.kind === 'record');
        if (record && spare(record)) return record;
        if (target) return list.find(o => o.kind === 'move' && o.to === target.trip.path[0]);
        if (b.pos === 0) return list.find(o => o.kind === 'leave');
        return list.find(o => o.kind === 'move' && o.to === home.path[0]);
    }

    /** The best plan with the whole map known, for the headless comparison: exhaustive, every action cost ≥ 1 so it always ends. */
    function bestPlan(L, start) {
        const memo = new Map(), noInjury = () => 1;
        function best(b) {
            const key = `${b.pos}|${b.air}|${b.visited}|${b.taken}|${b.isRecorded}|${b.isForced}|${b.isPocketUsed}`;
            if (memo.has(key)) return memo.get(key);
            let top = { value: -Infinity, action: null };
            options(L, b).list.filter(o => o.isSafe).forEach(o => {
                if (o.kind === 'leave') { const v = PLAN_VALUE.airLeft * b.air; if (v > top.value) top = { value: v, action: o }; return; }
                const { next } = apply(L, b, o, noInjury);
                let gain = 0;
                if (o.kind === 'move' && o.to === L.command && !b.reachedCommand) gain = PLAN_VALUE.command;
                if (o.kind === 'take') gain = o.find.value - o.risk * PLAN_VALUE.injury;
                if (o.kind === 'record') gain = PLAN_VALUE.name;
                const v = gain + best(next).value;
                if (v > top.value) top = { value: v, action: o };
            });
            memo.set(key, top);
            return top;
        }
        return b => best(b).action;
    }

    // ── the picture (2026-10-11): the travel view's look, as the redrawn minigames (src/systems/minigames, art/) ──
    // The station is cut away like the living ship's decks: every room a module with its back wall, ceiling lamp, floor and
    // the things it holds, painted in art pixels with the Deep field ramps and 8 × 8 Bayer dither; the corridors are hull
    // tubes and ladder shafts; our Lander is docked at the airlock; the boarder is a crew-hires person in an EVA suit
    // (MiniCrew.small), whose helmet lamp is the warm light in the room they stand in. The still parts are painted once and
    // kept (the space and hull per station, each room per look); the moving layer (lamps, frost, grit, the way out, the
    // boarder) is drawn eight times a second. The art kit (window.MiniPaint, MiniCrew, MiniShip) is loaded by MiniLab.js
    // in both modes; it is only read when a boarding opens. Without it the picture is a plain dark map (never expected).
    const AW = 720, AH = 380, PICK_H = 200;                                    // the walk picture and the picker's strip, in art pixels
    const TICK_MS = 125, MOVE_TICKS = 4, WALK_STEP_MS = 520, AURA_STEP_MS = 700;
    const ATTACH_GRACE_MS = 5000, RESULT_DELAY_MS = 500;
    // a station plan on screen: cells, rooms, the hull around them, the floor, the corridor bore and the ladder shaft's half width
    const GRID = { x0: 100, y0: 26, pitchX: 152, pitchY: 116, roomW: 120, roomH: 90, shell: 6, floor: 10, bore: 30, shaft: 10, k: 1 };
    const OUTSIDE = { x0: 372, y0: 20, pitchX: 76, pitchY: 58, roomW: 60, roomH: 45, shell: 3, floor: 5, bore: 15, shaft: 5, k: 0.5 };
    const PERSON_H = 30, CEIL = 8, LANDER_LEN = 240, COLLAR = 10;
    const SPACE_LIGHT = 0.24;                                                     // no sun out here: the rust dust stays faint (the universe is cold)
    const ACT_TICKS = 5;                                                          // the boarder kneels this long after a search
    const PORTRAIT_IDS = { F_1: 'cora', M_2: 'jaxon', F_3: 'aris', M_4: 'vance', F_5: 'mira' };
    // the words' colours (minigames.css): Graphite, amber for people, ice for instruments
    const WORDS = '#e4e4e0', QUIET = '#8b8d90', FAINT = '#5a6168', STEEL_T = '#c9d1d6', AMBER_T = '#f08c2e', AMBER_BR = '#ffc27a', RED_T = '#e0453a', ICE_T = '#9fd8e6';
    const COND_COLOR = { DARK: QUIET, VENTED: ICE_T, UNSTABLE: '#f0a24a', SEALED: '#e2574c' };
    const INK = '#05070a';

    const P = () => window.MiniPaint || null;
    const roomBox = (G, r) => ({ x: G.x0 + r.col * G.pitchX, y: G.y0 + r.row * G.pitchY, w: G.roomW, h: G.roomH });
    const roomFloor = (G, r) => { const box = roomBox(G, r); return { x: box.x + Math.round(box.w / 2), y: box.y + box.h - G.floor }; };
    const doorPairs = L => { const out = []; L.adj.forEach((list, a) => list.forEach(b => { if (a < b) out.push([a, b]); })); return out; };
    const artSeed = id => Math.floor(seeded(`${id}:art`)() * 1e6);
    const rustOf = age => Math.max(0.12, Math.min(0.85, 0.12 + age / 480));      // older stations rust more

    // the living ship's interior ramps (src/newscreen/ship/ShipArt.js, as MiniShip has them), from the ink, plus the station's hull
    let RAMPS = null;
    function ramps() {
        const N = P();
        if (RAMPS || !N) return RAMPS;
        const mk = (...hex) => N.ramp(N.INK, ...hex);
        RAMPS = {
            HULL: mk('#0e1418', '#18222a', '#253239', '#3a4a52', '#5c6e76', '#8ea0a6'),
            WALL: mk('#090e12', '#0e151a', '#131c22', '#19252c', '#213038', '#2c3e47', '#3c525c', '#566e78'),
            WARM: mk('#0e0c0a', '#16120e', '#211a13', '#2e2419', '#3f3121', '#57432c', '#76593a'),
            STEEL: mk('#0d1317', '#151e24', '#1e2a31', '#29373f', '#37474f', '#4b5d66', '#677a82', '#8c9ea4'),
            SCR: mk('#0b2a30', '#11505a', '#1e8c96', '#58d6dc', '#b8f6f4'),
            CRATE: mk('#111715', '#1b2420', '#27322d', '#36433d', '#4c5b54', '#6c7d74'),
            LINEN: mk('#1e2226', '#363c40', '#565d60', '#7f8584', '#a9ada6', '#cfd0c6'),
            MED: mk('#141c1e', '#26333a', '#40525a', '#65797f', '#93a8aa', '#c3d3d0', '#e4eeea'),
            GLASS: mk('#0c201d', '#163830', '#24584a', '#3f8a72', '#7cc4a6'),
            PAPER: mk('#1f1d19', '#38342b', '#5a5442', '#827a60', '#aaa082', '#cbc2a2'),
            SKIN: mk('#2a1c1a', '#4a3029', '#6e4a3e', '#a87a62'),
            RUST: N.RP.RUST, ICE: N.RP.ICE, UI: N.RP.UI, AMBER: N.RP.AMBER, RED: N.RP.RED, STAR: N.RP.STAR, HAZE: N.RP.HAZE,
        };
        return RAMPS;
    }

    /** Which way each door of room r leads: { left, right, up, down } (the airlock's left is our ship). */
    function sidesOf(L, r) {
        const s = { left: r.type === 'AIRLOCK', right: false, up: false, down: false };
        L.adj[r.id].forEach(n => {
            const o = L.rooms[n];
            if (o.row === r.row) s[o.col < r.col ? 'left' : 'right'] = true; else s[o.row < r.row ? 'up' : 'down'] = true;
        });
        return s;
    }

    // ── the still layer: space, the station's hull (every module closed, as seen from outside), the corridors, our Lander ──
    function paintBase(G, L, W, H, seed, rust) {
        const N = P(), R = ramps(), p = N.painter(W, H, true), k = G.k;
        N.paintSpace(p, N.spaceStrip(W, H, seed, 0.3, 0.7, 0.7), 0, new Float32Array(W * H).fill(SPACE_LIGHT));
        const plate = (x, y, v) => {
            if (rust > 0 && N.fbm(x / 13, y / 9, seed + 23, 3) > 1 - rust * 0.42) { p.solid(x, y, R.RUST, v * 1.2 + (N.fbm(x / 4, y / 4, seed, 2) - 0.5) * 0.3); return; }
            p.solid(x, y, R.HULL, v + (N.fbm(x / 8, y / 6, seed + 11, 3) - 0.5) * 0.2);
        };
        const ts = Math.max(2, Math.round(4 * k)), fl = Math.max(2, Math.round(4 * k));
        const air = L.rooms[0], airBox = roomBox(G, air), airFloor = airBox.y + airBox.h - G.floor;
        // the docking collar from our Lander's nose to the airlock
        const noseX = airBox.x - G.shell - Math.round(COLLAR * k);
        p.region(noseX - 2, airFloor - G.bore - ts, airBox.x, airFloor + fl + ts, (x, y) => {
            const rel = y - (airFloor - G.bore);
            if (rel < 0) plate(x, y, rel === -ts ? 0.8 : 0.48);
            else if (y >= airFloor + fl) plate(x, y, 0.2);
            else if (x < noseX + Math.max(2, Math.round(3 * k))) plate(x, y, 0.62);       // the flange against the nose
            else p.solid(x, y, R.WALL, y < airFloor ? 0.16 : 0.42);
        });
        L.rooms.forEach(r => paintModule(p, G, r, plate));
        doorPairs(L).forEach(([a, b]) => paintTube(p, G, L.rooms[a], L.rooms[b], plate, ts, fl));
        const canvas = p.canvas(), ctx = canvas.getContext('2d');
        if (window.MiniShip) window.MiniShip.lander(ctx, { x: noseX + 1, y: airFloor - Math.round(G.bore / 2), len: Math.round(LANDER_LEN * k), flip: true, anchor: 0, light: 0.9 });
        return canvas;
    }

    /** One module's hull shell, and the module closed, as seen from outside (plates and dark window slots). */
    function paintModule(p, G, r, plate) {
        const R = ramps(), b = roomBox(G, r), s = G.shell, k = G.k;
        const ph = Math.max(6, Math.round(15 * k)), pw = Math.max(10, Math.round(30 * k));
        const wy = Math.round(11 * k), wh = Math.max(2, Math.round(4 * k)), slot = Math.max(3, Math.round(12 * k)), gap = Math.max(6, Math.round(22 * k)), margin = Math.round(14 * k);
        p.region(b.x - s, b.y - s, b.x + b.w + s, b.y + b.h + s, (x, y) => {
            const isCornerX = x === b.x - s || x === b.x + b.w + s - 1, isCornerY = y === b.y - s || y === b.y + b.h + s - 1;
            if (isCornerX && isCornerY) return;                                                // rounded corners
            const lx = x - b.x, ly = y - b.y;
            if (lx >= 0 && lx < b.w && ly >= 0 && ly < b.h) {
                if (ly >= wy && ly < wy + wh && lx >= margin && lx < b.w - margin && (lx - margin) % gap < slot) { p.solid(x, y, R.HULL, 0.05); return; }
                let v = 0.3 + 0.12 * (lx / b.w) - 0.12 * (ly / b.h);                           // lit from the upper right
                if (ly % ph === 0) v -= 0.14; else if (ly % ph === 1) v += 0.06;
                if ((lx + Math.floor(ly / ph) * Math.round(pw / 2)) % pw === 0) v -= 0.1;
                plate(x, y, v);
                return;
            }
            let v = 0.42;
            if (ly < 0) v = y === b.y - s ? 0.88 : 0.56;
            else if (lx >= b.w) v = x === b.x + b.w + s - 1 ? 0.7 : 0.5;
            else if (lx < 0) v = x === b.x - s ? 0.22 : 0.32;
            else v = y === b.y + b.h + s - 1 ? 0.1 : 0.24;
            if (lx > 0 && lx < b.w && lx % pw === 0) v -= 0.12;
            plate(x, y, v);
        });
    }

    /** A corridor between two rooms: a hull tube at floor level, or a ladder shaft between decks. Carves the doorways. */
    function paintTube(p, G, A, B, plate, ts, fl) {
        const R = ramps(), [a, b] = A.col + A.row <= B.col + B.row ? [A, B] : [B, A];
        const ba = roomBox(G, a), bb = roomBox(G, b), s = G.shell, k = G.k;
        if (a.row === b.row) {
            const fy = ba.y + ba.h - G.floor, x0 = ba.x + ba.w, x1 = bb.x, rib = Math.max(4, Math.round(8 * k));
            p.region(x0, fy - G.bore - ts, x1, fy + fl + ts, (x, y) => {
                const isGap = x >= x0 + s && x < x1 - s, rel = y - (fy - G.bore);
                if (rel < 0) { if (isGap) plate(x, y, (rel === -ts ? 0.82 : 0.5) - ((x - x0) % rib === 0 ? 0.16 : 0)); return; }
                if (y >= fy + fl) { if (isGap) plate(x, y, 0.2); return; }
                if (y < fy) p.solid(x, y, R.WALL, 0.14 + (isGap && (x - x0) % rib === 0 ? 0.08 : 0) + (rel < 2 ? 0.06 : 0));
                else p.solid(x, y, R.STEEL, y === fy ? 0.6 : ((x & 3) === 0 ? 0.18 : 0.34));
            });
            return;
        }
        const cx = ba.x + Math.round(ba.w / 2), sh = G.shaft, y0 = ba.y + ba.h, y1 = bb.y, rung = Math.max(3, Math.round(4 * k));
        p.region(cx - sh - ts, y0, cx + sh + ts, y1, (x, y) => {
            const dx = x - cx, isGap = y >= y0 + s && y < y1 - s;
            if (Math.abs(dx + 0.5) >= sh) { if (isGap) plate(x, y, dx > 0 ? (x === cx + sh + ts - 1 ? 0.7 : 0.48) : 0.26); return; }
            const isRail = x === cx - sh + Math.max(1, Math.round(3 * k)) || x === cx + sh - 1 - Math.max(1, Math.round(3 * k));
            if (isRail) p.solid(x, y, R.STEEL, 0.5);
            else if ((y - y0) % rung === 0 && Math.abs(dx + 0.5) < sh - Math.round(3 * k)) p.solid(x, y, R.STEEL, 0.36);
            else p.solid(x, y, R.WALL, 0.12);
        });
    }

    // ── the inside of a room, painted once per look: 'seen' (only its door: dark, a question mark) or 'known' ──
    function paintRoom(G, L, r, o) {
        const N = P(), R = ramps(), b = roomBox(G, r), w = b.w, h = b.h, fy = h - G.floor, cx = Math.round(w / 2);
        const p = N.painter(w, h, true), seed = o.seed, isKnown = o.look === 'known', isDark = r.cond === 'DARK';
        const isLamp = isKnown && !isDark && r.type !== 'CORRIDOR', lampX = r.type === 'AIRLOCK' ? 40 : Math.round(w * 0.3);
        const base = (isKnown ? 0.56 : 0.2) * (isDark ? 0.45 : 1), reach = isDark ? 44 : 76;
        const lightMap = new Float32Array(w * h), warmMap = new Float32Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const helm = o.isHere ? 0.8 * Math.max(0, 1 - Math.hypot(x - cx, (y - (fy - 24)) * 1.15) / reach) ** 1.3 : 0;
            const lamp = isLamp ? 0.42 * Math.max(0, 1 - Math.hypot(x - lampX, (y - CEIL) * 0.9) / 62) ** 1.5 : 0;
            lightMap[y * w + x] = base + helm + lamp; warmMap[y * w + x] = helm / (base + helm + lamp);
        }
        const at = (x, y) => lightMap[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
        const set = (x, y, ramp, v) => { if (x < 0 || y < 0 || x >= w || y >= h) return; p.set(x, y, ramp.rgb[N.level(ramp, v, x + b.x, y + b.y)]); };
        const put = (x, y, ramp, v) => set(x, y, ramp, v * at(x, y));                       // lit by the room's light
        const glow = (x, y, ramp, v) => set(x, y, ramp, v * (isKnown ? 1 : 0.4));           // its own light (screens, the cell)
        const warmAt = (x, y) => warmMap[y * w + x] * 0.95 > N.threshold(x + b.x + 3, y + b.y + 1);
        const slab = (x0, y0, ww, hh, ramp, v, q = {}) => {
            for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) {
                let t = v;
                if (q.rim !== false && y === y0) t += 0.26;                                  // the lit top edge
                if (x === x0 + ww - 1) t += 0.08; else if (x === x0) t -= 0.1;               // the light is to the right
                t -= ((y - y0) / Math.max(1, hh)) * (q.fall == null ? 0.12 : q.fall);
                if (q.grain) t += (N.vnoise((x + b.x) / 3, (y + b.y) / 3, seed) - 0.5) * q.grain;
                (q.lit ? glow : put)(x, y, ramp, t);
            }
        };
        const sides = sidesOf(L, r), sh = G.shaft;
        // the back wall: ribbed panels, a seam, grime and the station's age in rust; the helmet lamp's pool warms it
        const seam = Math.round(CEIL + (fy - CEIL) * 0.46);
        for (let y = CEIL; y < fy; y++) for (let x = 0; x < w; x++) {
            const px = (x + 4) % 24;
            let v = px < 2 ? 0.34 : px === 2 ? 0.74 : 0.56;
            if (y === CEIL || y === CEIL + 1) v = 0.3;
            if (y === seam) v -= 0.2; else if (y === seam + 1) v += 0.08;
            if (y > fy - 9) v *= 0.82;                                                        // the kick plate
            v += (N.fbm((x + b.x) / 9, (y + b.y) / 7, seed + 5, 3) - 0.5) * 0.34;
            if (N.fbm((x + b.x) / 11, (y + b.y) / 8, seed + 29, 3) > 1 - o.rust * 0.36) { put(x, y, R.RUST, v * 1.1); continue; }
            put(x, y, warmAt(x, y) ? R.WARM : R.WALL, v);
        }
        // the ceiling: a pipe and the lamp housing
        for (let y = 0; y < CEIL; y++) for (let x = 0; x < w; x++) {
            let v = y === CEIL - 1 ? 0.18 : 0.3;
            if (y >= 2 && y <= 4) v = y === 2 ? 0.7 : 0.5;
            if (y >= 2 && y <= 4 && (x + 3) % 30 < 2) v = 0.24;                               // the pipe's clamps
            put(x, y, R.STEEL, v);
        }
        for (let x = lampX - 7; x < lampX + 7; x++) { put(x, CEIL - 2, R.STEEL, 0.6); if (isLamp) glow(x, CEIL - 1, R.ICE, x === lampX - 7 || x === lampX + 6 ? 0.5 : 0.82); else put(x, CEIL - 1, R.STEEL, 0.14); }
        // the floor: a lit lip, the grating, the slab
        for (let y = fy; y < h; y++) for (let x = 0; x < w; x++) put(x, y, R.STEEL, y === fy ? 0.78 : y < fy + 3 ? ((x & 3) === 0 ? 0.2 : 0.46) : 0.3 - (y - fy) * 0.015);
        // doorways (the corridor runs in at floor level) and the ladder hatches (the shaft runs through the middle)
        const doorway = (x0, dir) => {
            for (let y = fy - G.bore; y < fy; y++) for (let x = x0; x < x0 + 7; x++) put(x, y, R.WALL, 0.12 + (y - fy + G.bore) / G.bore * 0.04);
            const jamb = dir < 0 ? x0 + 7 : x0 - 2;
            for (let y = fy - G.bore - 2; y < fy; y++) for (let x = jamb; x < jamb + 2; x++) put(x, y, R.STEEL, x === jamb + (dir < 0 ? 1 : 0) ? 0.7 : 0.45);
            for (let x = Math.min(x0, jamb); x < Math.max(x0 + 7, jamb + 2); x++) { put(x, fy - G.bore - 2, R.STEEL, 0.72); put(x, fy - G.bore - 1, R.STEEL, 0.4); }
        };
        if (sides.left) doorway(0, -1);
        if (sides.right) doorway(w - 7, 1);
        if (sides.up || sides.down) {
            const top = sides.up ? 0 : fy - 8, rail = sh - 3;
            for (let y = top; y < fy; y++) for (const x of [cx - rail, cx + rail - 1]) put(x, y, R.STEEL, 0.55);
            for (let y = top + 3; y < fy; y += 5) for (let x = cx - rail + 1; x < cx + rail - 1; x++) put(x, y, R.STEEL, 0.4);
            if (sides.up) for (let y = 0; y < CEIL; y++) for (let x = cx - sh; x < cx + sh; x++) if (x !== cx - rail && x !== cx + rail - 1) put(x, y, R.WALL, 0.1);
            if (sides.down) for (let x = cx - sh; x < cx + sh; x++) { put(x, fy, R.STEEL, x === cx - sh || x === cx + sh - 1 ? 0.8 : 0.62); for (let y = fy + 1; y < h; y++) put(x, y, R.WALL, (x - cx + sh) % 3 === 0 ? 0.4 : 0.1); }
        }
        if (isKnown || o.look === 'seen') paintCondition(r, { w, h, fy, put, set, slab, R, N, seed, bx: b.x, by: b.y });
        if (isKnown) {
            const draw = PROPS[r.type];
            if (draw) draw({ w, h, fy, cx, put, set, glow, slab, R, N, seed, isTaken: o.isTaken, find: r.find, bx: b.x, by: b.y });
            if (o.wallName) {                                                                 // the name, then the hull, scratched in two lines on a bare bit of wall
                const at = NAME_AT[r.type] || NAME_AT.default;
                o.wallName.toUpperCase().split(', ').forEach((line, i) => {
                    let text = line;
                    while (text.length > 1 && at[0] + N.pixelTextWidth(text) > w - 6) text = text.slice(0, -1);
                    N.pixelText(text, at[0], at[1] + i * 8, (x, y) => put(x, y, R.WALL, 0.95));
                });
            }
        } else {
            N.pixelText('?', 0, 0, (x, y) => { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) set(cx - 3 + x * 2 + dx, Math.round(fy / 2) - 4 + y * 2 + dy, R.UI, 0.5); });
        }
        return p.canvas();
    }

    /** The marks a room's condition leaves in the still picture (the moving parts are in drawLive). */
    function paintCondition(r, a) {
        const { w, fy, put, set, R, N, seed } = a;
        if (r.cond === 'VENTED') {                                                         // a hole in the back wall, space behind it
            const hx = w - 26, hy = CEIL + 14;
            for (let y = hy - 10; y < hy + 10; y++) for (let x = hx - 12; x < hx + 12; x++) {
                const d = Math.hypot((x - hx) / 11, (y - hy) / 8) + (N.vnoise(x / 2.5, y / 2.5, seed + 3) - 0.5) * 0.5;
                if (d < 0.78) { const isStar = N.hash(x + a.bx, y + a.by, 9) > 0.93; set(x, y, isStar ? R.STAR : R.HAZE, isStar ? 0.75 : 0.25); }
                else if (d < 1) put(x, y, R.STEEL, 0.85 - (d - 0.78) * 2);
            }
        } else if (r.cond === 'UNSTABLE') {                                                // a ceiling panel hanging down, cracks in the wall
            for (let i = 0; i < 26; i++) { const x = 16 + i, y = CEIL + Math.round(i * 0.55); for (let t = 0; t < 3; t++) put(x, y + t, R.STEEL, t === 0 ? 0.8 : 0.45); }
            let x = 70, y = CEIL + 2;
            while (y < fy - 20) { put(x, y, R.WALL, 0.02); put(x + 1, y, R.WALL, 0.75); y += 1; x += N.hash(x, y, seed) > 0.5 ? 1 : -1; }
        }                                                                                  // DARK: no lamp and less light (paintRoom)
    }

    const NAME_AT = { default: [6, 44], CREW: [6, 14], POWER: [6, 62], LAB: [6, 36] };   // where a name scratched into the wall goes, clear of the room's things
    // what each room holds, drawn where the boarder does not stand (the middle is the walkway and the ladder)
    const crate = (a, x, y, cw, ch, v = 0.55) => {
        a.slab(x, y, cw, ch, a.R.CRATE, v, { grain: 0.18 });
        for (let i = x + 1; i < x + cw - 1; i++) a.put(i, y + Math.round(ch * 0.45), a.R.CRATE, v - 0.24);       // the strap
    };
    const PROPS = {
        AIRLOCK(a) {
            const { fy, put, slab, R } = a;
            for (let x = 8; x < 40; x++) for (let y = fy + 1; y < fy + 4; y++) put(x, y, (x + y) % 8 < 4 ? R.AMBER : R.STEEL, (x + y) % 8 < 4 ? 0.42 : 0.2);   // hazard stripes at the hatch
            slab(88, 26, 24, fy - 26, R.STEEL, 0.42);                                          // the suit locker
            for (let y = 28; y < fy - 1; y++) put(99, y, R.STEEL, 0.16);
            slab(91, 34, 5, 2, R.STEEL, 0.7, { rim: false }); slab(103, 34, 5, 2, R.STEEL, 0.7, { rim: false });
            slab(66, 30, 12, 9, R.STEEL, 0.36);                                                // the pressure panel
            for (let x = 68; x < 76; x++) for (let y = 32; y < 37; y++) a.glow(x, y, R.SCR, 0.35 + ((x + y) % 3 === 0 ? 0.25 : 0));
        },
        STORES(a) {
            const { fy, slab, R, isTaken } = a;
            [70, 111].forEach(x => slab(x, 24, 3, fy - 24, R.STEEL, 0.5, { fall: 0.25 }));
            [44, 63].forEach(y => slab(70, y, 44, 2, R.STEEL, 0.62, { fall: 0 }));
            if (isTaken) { crate(a, 96, 36, 12, 8, 0.4); slab(80, fy - 3, 10, 3, R.CRATE, 0.3); return; }
            crate(a, 74, fy - 14, 18, 14); crate(a, 94, fy - 10, 15, 10, 0.48);
            crate(a, 75, 51, 12, 12, 0.5); crate(a, 89, 49, 20, 14);
            crate(a, 80, 32, 22, 12, 0.5);
            crate(a, 14, fy - 16, 20, 16, 0.46);
        },
        POWER(a) {
            const { fy, slab, R, isTaken } = a;
            [66, 84, 102].forEach((x, i) => {
                slab(x, 26, 16, fy - 26, R.STEEL, 0.4 + i * 0.03, { grain: 0.1 });
                for (let y = 30; y < fy - 4; y += 4) for (let xx = x + 3; xx < x + 13; xx++) a.put(xx, y, R.STEEL, 0.2);  // vents
            });
            for (let y = 42; y < 64; y++) for (let x = 87; x < 97; x++) {                   // the cell's slot
                if (isTaken) { a.put(x, y, R.WALL, 0.08); continue; }
                const edge = x === 87 || x === 96 || y === 42 || y === 63;
                a.glow(x, y, R.UI, edge ? 0.55 : 0.68 + (y % 4 === 0 ? 0.12 : 0) - Math.abs(x - 91.5) * 0.03);
            }
            slab(10, 38, 22, 18, R.STEEL, 0.38);                                              // the switchboard
            for (let x = 13; x < 29; x++) for (let y = 41; y < 47; y++) a.glow(x, y, R.SCR, 0.3);
        },
        MEDBAY(a) {
            const { fy, slab, R, put, isTaken } = a;
            [6, 30].forEach(x0 => {                                                            // the two beds, a pillow on each
                slab(x0, fy - 16, 22, 5, R.LINEN, 0.6, { grain: 0.15 });
                slab(x0, fy - 11, 22, 2, R.STEEL, 0.5); [x0 + 2, x0 + 18].forEach(x => slab(x, fy - 9, 2, 9, R.STEEL, 0.4, { rim: false }));
                slab(x0, fy - 20, 7, 4, R.LINEN, 0.7);
            });
            slab(84, 28, 26, 40, R.MED, 0.48);                                                 // the cabinet
            if (isTaken) { for (let y = 30; y < 66; y++) for (let x = 86; x < 108; x++) put(x, y, R.WALL, 0.08); slab(110, 28, 3, 40, R.MED, 0.6); return; }
            for (let y = 30; y < 66; y++) put(97, y, R.MED, 0.2);
            for (let i = -3; i <= 3; i++) { put(97 + i, 40, R.RED, 0.75); put(97, 40 + i, R.RED, 0.75); }
        },
        CREW(a) {
            const { fy, slab, R, put, isTaken } = a;
            [66, 114].forEach(x => slab(x, 24, 2, fy - 24, R.STEEL, 0.5, { fall: 0.2 }));
            [[38, 66], [60, 66]].forEach(([y, x]) => { slab(x, y + 4, 50, 2, R.STEEL, 0.55, { fall: 0 }); slab(x + 2, y, 44, 4, R.LINEN, 0.5, { grain: 0.3 }); });
            slab(10, 28, 18, fy - 28, R.STEEL, 0.36); for (let y = 30; y < fy - 2; y++) put(19, y, R.STEEL, 0.14);   // a locker
            slab(40, 30, 6, 7, R.PAPER, 0.5);                                                  // a photograph on the wall
            if (!isTaken) slab(82, 57, 7, 3, R.PAPER, 0.8);                                     // the diary, on the lower bunk
        },
        CRYO(a) {
            const { fy, slab, R, put, glow, isTaken } = a;
            for (let x = 84; x < 100; x += 5) for (let y = 0; y < 18; y++) put(x, y, R.STEEL, 0.32);   // cables from the ceiling
            if (isTaken) {
                slab(74, fy - 6, 34, 6, R.STEEL, 0.45);                                            // the empty cradle, the cut cables
                [84, 89, 94, 99].forEach((x, i) => { for (let y = 18; y < 24 + i * 3; y++) put(x, y, R.STEEL, 0.32); });
                return;
            }
            slab(76, 18, 30, fy - 18, R.STEEL, 0.46);
            for (let y = 24; y < fy - 8; y++) for (let x = 81; x < 101; x++) {
                const body = Math.hypot((x - 91) / 4, (y - 32) / 4) < 1 || (Math.abs(x - 91) < 5 - (y > 56 ? 1 : 0) && y > 36 && y < fy - 12);
                glow(x, y, body ? R.SKIN : R.GLASS, body ? 0.42 : 0.48 + (a.N.vnoise(x / 2, y / 3, a.seed) - 0.5) * 0.3 + (x === 82 ? 0.25 : 0));
            }
        },
        LAB(a) {
            const { fy, slab, R, glow } = a;
            [64, 82, 100].forEach((x, i) => {
                slab(x, 22, 15, fy - 22, R.STEEL, 0.38);
                for (let y = 27; y < 35; y++) for (let xx = x + 2; xx < x + 13; xx++) glow(xx, y, R.SCR, 0.32 + ((xx + y + i) % 5 === 0 ? 0.3 : 0));
            });
            slab(8, fy - 22, 36, 3, R.STEEL, 0.6); [10, 41].forEach(x => slab(x, fy - 19, 2, 19, R.STEEL, 0.4, { rim: false }));   // a bench
            slab(16, fy - 28, 10, 6, R.MED, 0.5);
        },
        COMMAND(a) {
            const { fy, slab, R, put, set, isTaken } = a;
            for (let y = 15; y < 44; y++) for (let x = 12; x < 94; x++) {                    // the window
                if (y === 15 || y === 43 || x === 12 || x === 93 || x === 39 || x === 66) { put(x, y, R.STEEL, 0.6); continue; }
                const isStar = a.N.hash(x + a.bx, y + a.by, 4) > 0.95;
                set(x, y, isStar ? R.STAR : R.HAZE, isStar ? 0.5 + a.N.hash(x, y, 5) * 0.5 : 0.18 + (a.N.fbm(x / 14, y / 8, a.seed + 2, 3) - 0.5) * 0.6);
            }
            slab(8, fy - 16, 104, 4, R.STEEL, 0.55);                                          // the console desk
            for (let y = fy - 12; y < fy; y++) for (let x = 10; x < 110; x++) put(x, y, R.STEEL, 0.24);
            slab(100, 48, 14, 10, R.STEEL, 0.36);                                              // the core panel
            if (!isTaken) for (let y = 50; y < 56; y++) for (let x = 102; x < 112; x++) a.glow(x, y, R.UI, 0.42 + ((x + y) % 3 === 0 ? 0.2 : 0));
        },
        CORRIDOR(a) {
            const { slab, R, put, isTaken, find } = a;
            if (!find) { slab(84, 40, 18, 18, R.STEEL, 0.3); return; }
            if (isTaken) { for (let y = 40; y < 58; y++) for (let x = 84; x < 102; x++) put(x, y, R.WALL, (x * 7 + y * 3) % 11 === 0 ? 0.6 : 0.06); slab(76, 70, 14, 2, R.STEEL, 0.6); return; }
            slab(84, 40, 18, 18, R.STEEL, 0.46);
            [[86, 42], [99, 42], [86, 55], [99, 55]].forEach(([x, y]) => put(x, y, R.STEEL, 0.9));   // its four screws
        },
    };

    /** The still picture of a room for this run's state, cached per look. */
    function roomCanvas(scene, L, b, r) {
        const isKnown = has(b.known, r.id), isSeen = has(b.seen, r.id);
        if (!isSeen && !isKnown) return null;                                                // closed: the base shows the module from outside
        const look = isKnown ? 'known' : 'seen', isHere = r.id === b.pos && !scene.isAboard, isTaken = has(b.taken, r.id), isCut = has(b.cut, r.id);   // back aboard: no helmet lamp left in the airlock
        const wallName = isKnown && L.nameRoom === r.id ? L.wallName : '';
        const key = [r.id, look, isHere, isTaken, isCut, wallName].join('|');
        let canvas = scene.rooms.get(key);
        if (!canvas) { canvas = paintRoom(GRID, L, r, { look, isHere, isTaken, wallName, seed: scene.seed, rust: scene.rust }); scene.rooms.set(key, canvas); }
        return canvas;
    }

    // ── the moving layer ──
    function drawLive(ctx, L, b, view, tick, scene) {
        const N = P(), R = ramps(), f = N.framer(ctx, AW, AH), t = tick * TICK_MS;
        const cmd = roomBox(GRID, L.rooms[L.command]);                                       // the station's one red beacon, on the command module
        if (tick % 16 < 2) { f.glow(cmd.x + cmd.w - 10, cmd.y - GRID.shell - 3, 6, R.RED, 0.85); f.px(cmd.x + cmd.w - 11, cmd.y - GRID.shell - 4, R.RED.hex[4], 2, 2); }
        else f.px(cmd.x + cmd.w - 10, cmd.y - GRID.shell - 3, R.RED.hex[2]);
        f.px(cmd.x + cmd.w - 10, cmd.y - GRID.shell - 1, R.STEEL.hex[4], 1, 1);
        L.rooms.forEach(r => {
            const box = roomBox(GRID, r), isSeen = has(b.seen, r.id), isKnown = has(b.known, r.id), at = (x, y) => [box.x + x, box.y + y];
            if (!isSeen) return;
            const fy = box.h - GRID.floor;
            if (r.cond === 'VENTED') for (let k = 0; k < 9; k++) {                           // air frosting out through the hole
                const u = ((k * 0.137 + tick * 0.09) % 1), [x, y] = at(14 + (box.w - 40) * u + (k % 3) * 3, 22 + ((k * 13) % (fy - 30)) * (1 - u));
                f.tone(x, y, R.ICE, 0.35 + 0.45 * u);
            }
            if (r.cond === 'UNSTABLE') for (let k = 0; k < 4; k++) {                          // grit falling from the ceiling
                const fall = (tick + k * 7) % 14, [x, y] = at(24 + k * 19, CEIL + 2 + fall * 5);
                if (y < box.y + fy) f.tone(x, y, R.STEEL, 0.6);
            }
            if (r.cond === 'SEALED' && !has(b.cut, r.id)) drawShutters(f, L, r, box, R, tick);
            if (!isKnown) return;
            const isTaken = has(b.taken, r.id);
            if (r.type === 'AIRLOCK') { const [x, y] = at(16, CEIL + 3); f.px(x, y, tick % 8 < 4 ? R.AMBER.hex[4] : R.AMBER.hex[2], 3, 2); if (tick % 8 < 4) f.glow(x + 1, y + 1, 4, R.AMBER, 0.35); }
            if (r.type === 'LAB') [64, 82, 100].forEach((x0, i) => { for (let j = 0; j < 3; j++) { const [x, y] = at(x0 + 3 + j * 4, 40 + ((i + j) % 2) * 6); f.px(x, y, (tick + i * 3 + j) % 6 < 3 ? R.SCR.hex[4] : R.SCR.hex[1], 2, 1); } });
            if (r.type === 'COMMAND') [14, 44, 74].forEach((x0, i) => { const [x, y] = at(x0, fy - 15); if ((tick + i * 5) % 9 > 1) f.px(x, y, (tick + i) % 4 ? R.SCR.hex[3] : R.SCR.hex[2], 16, 2); });
            if (r.type === 'CRYO' && !isTaken) { const [x, y] = at(89, 21); f.px(x, y, tick % 12 < 6 ? R.GLASS.hex[4] : R.GLASS.hex[2], 4, 1); }
            if (r.type === 'POWER' && !isTaken) { const [x, y] = at(88, 43 + (tick % 10) * 2); f.px(x, y, R.UI.hex[5], 8, 1); }
            if (r.type === 'CORRIDOR') for (let k = 0; k < 3; k++) {                          // loose cables drifting in the dark
                const sway = Math.round(Math.sin(t / 900 + k * 2) * 3);
                for (let y = 0; y < 18 + k * 6; y += 1) { const [x, yy] = at(30 + k * 16 + Math.round(sway * y / 30), CEIL + y); f.tone(x, yy, R.STEEL, 0.42); }
            }
        });
        if (L.jam) {                                                                         // a jammed door shows once you stand next to it
            const [a, c] = L.jam.split('-').map(Number), isJamSeen = b.isScanned || has(b.visited, a) || has(b.visited, c);
            if (isJamSeen && !b.isForced) drawJam(f, L, a, c, R, tick);
        }
        if (!view.isMoving && !view.isAboard) drawHomePath(f, L, b, view, R, tick);
        if (!view.isAboard) drawBoarder(ctx, f, b, view, R, tick);
    }

    /** A sealed room's bulkheads, shut across every doorway until someone cuts in: steel, red bands, a red lamp. */
    function drawShutters(f, L, r, box, R, tick) {
        const s = sidesOf(L, r), G = GRID, fy = box.y + box.h - G.floor, cx = box.x + Math.round(box.w / 2);
        const plate = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const isBand = (x + y) % 8 < 3; f.tone(x, y, isBand ? R.RED : R.STEEL, isBand ? 0.5 : (y === y0 ? 0.75 : 0.45)); } };
        if (s.left && r.type !== 'AIRLOCK') plate(box.x - G.shell, fy - G.bore, G.shell + 2, G.bore);
        if (s.right) plate(box.x + box.w - 2, fy - G.bore, G.shell + 2, G.bore);
        if (s.up) plate(cx - G.shaft, box.y - G.shell, G.shaft * 2, G.shell + 2);
        if (s.down) plate(cx - G.shaft, box.y + box.h - 2, G.shaft * 2, G.shell + 2);
        if (tick % 8 < 4) f.px(box.x + box.w - 9, box.y + CEIL + 3, R.RED.hex[3], 3, 2);
    }

    /** A jammed door half shut in its corridor, its lamp blinking amber. */
    function drawJam(f, L, a, c, R, tick) {
        const A = L.rooms[a], C = L.rooms[c], G = GRID, ba = roomBox(G, A), bc = roomBox(G, C);
        if (A.row === C.row) {
            const x = Math.round((Math.min(ba.x, bc.x) + G.roomW + Math.max(ba.x, bc.x)) / 2) - 1, fy = ba.y + ba.h - G.floor;
            for (let y = fy - G.bore; y < fy - 9; y++) for (let k = 0; k < 3; k++) f.tone(x + k, y, R.STEEL, k === 2 ? 0.7 : 0.45);
            f.px(x, fy - G.bore - 3, tick % 4 < 2 ? R.AMBER.hex[4] : R.AMBER.hex[2], 3, 2);
        } else {
            const y = Math.round((Math.min(ba.y, bc.y) + G.roomH + Math.max(ba.y, bc.y)) / 2) - 1, cx = ba.x + Math.round(ba.w / 2);
            for (let x = cx - G.shaft; x < cx + 3; x++) for (let k = 0; k < 3; k++) f.tone(x, y + k, R.STEEL, k === 0 ? 0.7 : 0.45);
            f.px(cx + G.shaft + 1, y, tick % 4 < 2 ? R.AMBER.hex[4] : R.AMBER.hex[2], 2, 3);
        }
    }

    /** The way out: small amber marks on the floors and up the shafts, from the boarder back to the airlock. */
    function drawHomePath(f, L, b, view, R, tick) {
        const path = homeRoute(L, b).path;
        if (!path.length) return;
        let from = { x: view.x, y: view.y - 1 };
        path.forEach(id => {
            const to = roomFloor(GRID, L.rooms[id]), to1 = { x: to.x, y: to.y - 1 }, steps = Math.ceil(Math.hypot(to1.x - from.x, to1.y - from.y) / 5);
            for (let k = 1; k < steps; k++) if ((k + tick) % 3) f.px(from.x + (to1.x - from.x) * k / steps, from.y + (to1.y - from.y) * k / steps, R.AMBER.hex[k % 2 ? 3 : 2], 2, 1);
            from = to1;
        });
    }

    /** The boarder: the crew member in their EVA suit, with whatever they carry; a red light on the suit when hurt. */
    function drawBoarder(ctx, f, b, view, R, tick) {
        const MC = window.MiniCrew, x = Math.round(view.x), y = Math.round(view.y), dir = view.facing < 0 ? -1 : 1;
        const isClimbing = view.isMoving && Math.abs(view.to.y - view.from.y) > Math.abs(view.to.x - view.from.x);
        const pose = isClimbing ? 'climb' : view.isMoving ? 'walk' : view.actUntil > tick ? 'kneel' : 'stand';
        if (b.haul.some(h => h.kind === 'pod')) {                                             // the sleeper pod, on a sled behind them
            const px = x - dir * 17;
            f.px(px - 5, y - 2, R.STEEL.hex[3], 12, 2);
            for (let yy = y - 21; yy < y - 2; yy++) for (let xx = px - 4; xx < px + 6; xx++) f.tone(xx, yy, xx === px - 4 || xx === px + 5 || yy === y - 21 ? R.STEEL : R.GLASS, xx === px + 5 ? 0.7 : 0.45);
        }
        if (MC) MC.small(ctx, view.who || 'cora', x, y, { h: PERSON_H, pose, t: tick * TICK_MS, facing: dir, suit: true, light: 1, warm: 0.5 });
        else f.px(x - 3, y - PERSON_H, STEEL_T, 6, PERSON_H);
        const handY = y - Math.round(PERSON_H * (pose === 'kneel' ? 0.28 : 0.42));
        if (b.haul.some(h => h.kind === 'energy')) for (let yy = y - 22; yy < y - 12; yy++) f.tone(x - dir * 6, yy, R.UI, 0.75), f.tone(x - dir * 7, yy, R.UI, 0.55);   // the cell on their back
        if (b.haul.some(h => h.hands > 0 && !h.heavy)) for (let yy = handY - 3; yy < handY + 3; yy++) for (let xx = 0; xx < 6; xx++) f.tone(x + dir * (5 + xx), yy, R.CRATE, yy === handY - 3 ? 0.8 : 0.5);
        if (b.isHurt && tick % 4 < 2) f.px(x + dir * 2, y - Math.round(PERSON_H * 0.62), R.RED.hex[3], 2, 2);
    }

    /** One frame of the walk: the station (cached), each room as it is known, and the moving layer. */
    function draw(ctx, L, b, view, tick, scene) {
        if (!P() || !ramps()) { ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, AH); return; }
        if (!scene.base) scene.base = paintBase(GRID, L, AW, AH, scene.seed, scene.rust);
        ctx.drawImage(scene.base, 0, 0);
        L.rooms.forEach(r => { const canvas = roomCanvas(scene, L, b, r); if (canvas) { const box = roomBox(GRID, r); ctx.drawImage(canvas, box.x, box.y); } });
        drawLive(ctx, L, b, view, tick, scene);
    }

    /** The picker's strip: the station from outside, every module closed, our Lander docked, the beacon blinking. */
    function drawOutside(ctx, L, tick, scene) {
        if (!P() || !ramps()) { ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, PICK_H); return; }
        if (!scene.outside) scene.outside = paintBase(OUTSIDE, L, AW, PICK_H, scene.seed, scene.rust);
        ctx.drawImage(scene.outside, 0, 0);
        const R = ramps(), f = P().framer(ctx, AW, PICK_H), cmd = roomBox(OUTSIDE, L.rooms[L.command]), bx = cmd.x + cmd.w - 6, by = cmd.y - OUTSIDE.shell - 2;
        if (tick % 16 < 2) { f.glow(bx, by, 5, R.RED, 0.85); f.px(bx, by, R.RED.hex[4], 1, 1); } else f.px(bx, by, R.RED.hex[2]);
    }

    /** A crew member in their suit, for the picker: a small canvas in art pixels. */
    function figureCanvas(who) {
        const c = document.createElement('canvas'); c.width = 34; c.height = 50;
        if (window.MiniCrew) window.MiniCrew.small(c.getContext('2d'), who, 17, 48, { h: 44, pose: 'stand', facing: 1, suit: true, light: 1, warm: 0.15 });
        return c;
    }

    // ── the frame: the minigames' (minigames.css), so the boarding is one family with them: one quiet header line, the picture,
    //    the few readouts as small mono words under it, the room and the last thing that happened as the voice line, the
    //    choices as plain words that warm when pointed at, the way on (Continue) a real button as in minigames.css. The doors
    //    are quiet labels on the picture itself. ──
    const FIT_MARGIN = 16, CRISP_MIN_FILL = 0.8, WALK_CHROME = 272;                      // WALK_CHROME: the words around the walk picture, px
    const TIGHT_BELOW = 1.5;                                                             // screen px per art px under which the door labels go small
    const LABEL_BAND = 30, NAME_CLEAR = 0.72;                                            // art px a room's label covers from its top; where it moves when a name is scratched there
    // the type and the easing (minigames.css's --mg-f-* and --mg-ease), as custom properties on the overlay: as plain JS
    // strings tools/export_script.js would list them in docs/script as lines a player reads
    const TYPE = `--bx-f-ui: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; --bx-f-text: 'IBM Plex Sans', system-ui, sans-serif; --bx-f-num: 'IBM Plex Mono', ui-monospace, Consolas, monospace; --bx-ease: cubic-bezier(0.2, 0.7, 0.2, 1);`;
    const STYLE = `
.warp-plot.boarding.bx { ${TYPE} z-index: 6000; background: rgba(5, 7, 10, 0.95); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); color: ${WORDS}; font: 400 15px/1.4 var(--bx-f-text); -webkit-font-smoothing: antialiased; padding: ${FIT_MARGIN}px; overflow: auto; }
.bx .bx-frame { width: min-content; display: grid; gap: 12px; animation: bx-in 250ms ease-out; }
@keyframes bx-in { from { opacity: 0; } }
.bx .bx-head { display: flex; align-items: baseline; gap: 16px; min-height: 26px; padding: 0 2px; text-shadow: 0 1px 0 ${INK}; }
.bx .bx-kicker { margin: 0; font: 500 12px/1 var(--bx-f-ui); letter-spacing: 0.24em; text-transform: uppercase; color: ${QUIET}; white-space: nowrap; }
.bx .bx-title { margin: 0; font: 300 22px/1.1 var(--bx-f-text); letter-spacing: 0.06em; color: ${WORDS}; white-space: nowrap; }
.bx .bx-screen { position: relative; background: ${INK}; box-shadow: 0 0 0 1px rgba(201, 209, 214, 0.07), 0 30px 90px rgba(0, 0, 0, 0.6); }
.bx .bx-canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.bx .bx-doors { position: absolute; inset: 0; pointer-events: none; }
.bx .bx-door { position: absolute; transform: translateX(-50%); display: grid; justify-items: center; gap: 1px; margin: 0; padding: 2px 4px; border: 0; background: none; font: 400 12px/1.15 var(--bx-f-num); letter-spacing: 0.04em; color: ${STEEL_T}; text-shadow: 0 1px 0 ${INK}, 0 0 6px rgba(5, 7, 10, 0.95); white-space: nowrap; pointer-events: auto; cursor: pointer; transition: color 140ms var(--bx-ease), transform 140ms var(--bx-ease); }
.bx .bx-door::before { content: '\\203A'; position: absolute; left: -6px; top: 2px; color: ${FAINT}; transition: color 140ms var(--bx-ease); }
.bx .bx-door i { font-style: normal; font-size: 11px; letter-spacing: 0.12em; }
.bx .bx-door kbd { font: 400 12px/1.15 var(--bx-f-num); color: ${QUIET}; }
.bx .bx-door.is-homeward kbd { color: ${AMBER_T}; }
.bx .bx-door:hover:not([disabled]), .bx .bx-door:focus-visible { color: ${AMBER_T}; transform: translate(-50%, -2px); outline: none; }
.bx .bx-door:hover:not([disabled])::before, .bx .bx-door:focus-visible::before { color: ${AMBER_T}; }
.bx .bx-door:hover:not([disabled]) kbd, .bx .bx-door:focus-visible kbd { color: ${AMBER_BR}; }
.bx .bx-door:focus-visible { text-decoration: underline 1px; text-underline-offset: 3px; }
.bx .bx-door[disabled] { cursor: default; }
.bx .bx-door[disabled]::before { content: none; }
.bx .bx-door[disabled]:not(.is-stranding), .bx .bx-door[disabled]:not(.is-stranding) kbd { color: ${QUIET}; }
.bx .bx-door.is-stranding, .bx .bx-door.is-stranding kbd { color: ${RED_T}; opacity: 0.8; }
.bx.is-tight .bx-door, .bx.is-tight .bx-door kbd { font-size: 10px; line-height: 1.1; }
.bx.is-tight .bx-door i { font-size: 9px; }
.bx .bx-door.is-label { color: ${FAINT}; pointer-events: none; }
.bx .bx-door.is-label::before { content: none; }
.bx .bx-readout { contain: inline-size; display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 28px; margin: 0; padding: 0 2px; font: 400 13px/1.3 var(--bx-f-num); color: ${QUIET}; text-shadow: 0 1px 0 ${INK}; }
.bx .bx-air, .bx .bx-hands { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.bx .bx-label { color: ${FAINT}; letter-spacing: 0.04em; }
.bx .bx-air strong { font: 400 15px/1 var(--bx-f-num); color: ${STEEL_T}; }
.bx .bx-air strong small { font-size: 12px; color: ${FAINT}; }
.bx .bx-pips { display: inline-flex; gap: 3px; align-self: center; }
.bx .bx-pips i { width: 8px; height: 2px; background: ${STEEL_T}; opacity: 0.75; }
.bx .bx-pips i.is-home { background: ${AMBER_T}; opacity: 1; }
.bx .bx-pips i.is-spent { background: #33373e; opacity: 1; }
.bx .bx-pips i.is-mark { box-shadow: 0 -3px 0 ${AMBER_BR}; }
.bx .bx-air-note b { font-weight: 400; color: ${STEEL_T}; }
.bx .bx-air.is-low strong, .bx .bx-air.is-low .bx-air-note, .bx .bx-air.is-low .bx-air-note b { color: ${RED_T}; }
.bx .bx-air.is-low .bx-pips i.is-home { background: ${RED_T}; animation: bx-low 800ms steps(2) infinite; }
@keyframes bx-low { 50% { opacity: 0.4; } }
.bx .bx-slots { display: inline-flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 0; list-style: none; }
.bx .bx-slots li { color: ${STEEL_T}; }
.bx .bx-slots li::before { content: '\\25AA'; margin-right: 6px; color: ${FAINT}; }
.bx .bx-slots li.is-heavy::before { color: ${AMBER_T}; }
.bx .bx-slots li.is-heavy small { margin-left: 6px; font-size: 11px; color: ${AMBER_T}; letter-spacing: 0.1em; }
.bx .bx-slots li.is-free { color: ${FAINT}; }
.bx .bx-slots li.is-more::before { content: none; }
.bx .bx-pocket { color: ${QUIET}; }
.bx .bx-talk { contain: inline-size; min-height: 92px; display: grid; align-content: start; gap: 6px; padding: 2px 2px 0; text-shadow: 0 1px 0 ${INK}; }
.bx .bx-talk p { margin: 0; }
.bx .bx-here { display: flex; flex-wrap: wrap; gap: 2px 16px; font: 400 15px/1.45 var(--bx-f-text); color: ${QUIET}; }
.bx .bx-here b { font-weight: 500; color: ${WORDS}; }
.bx .bx-who { display: flex; align-items: center; gap: 8px; min-height: 15px; font: 500 14px/1 var(--bx-f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: ${STEEL_T}; }
.bx .bx-who .bx-ring { flex: none; width: 0.82em; height: 0.82em; border: 1px solid currentColor; border-radius: 50%; }
.bx .bx-who.is-empty .bx-ring { display: none; }
.bx .bx-line { max-width: 62ch; font: 400 20px/1.36 var(--bx-f-text); color: ${WORDS}; text-wrap: balance; }
.bx .bx-line.is-note { max-width: 86ch; font: 400 15px/1.6 var(--bx-f-num); color: #c7c9c6; }
.bx .bx-line.is-bad { color: ${RED_T}; }
.bx .bx-haul { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 26px; max-width: 110ch; margin: 0; padding: 0; list-style: none; font: 400 18px/1.45 var(--bx-f-text); color: ${WORDS}; }
.bx .bx-haul li::before { content: '\\25AA'; margin-right: 8px; font-size: 13px; color: ${FAINT}; }
.bx .bx-quiet { font: 400 14px/1.5 var(--bx-f-num); color: ${QUIET}; }
.bx .bx-buttons { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 30px; min-height: 36px; padding: 0 2px; }
.bx .bx-actions { display: contents; }
.bx .bx-btn { display: inline-flex; align-items: baseline; gap: 9px; padding: 6px 0; border: 0; background: none; color: ${WORDS}; font: 400 18px/1.25 var(--bx-f-text); letter-spacing: 0.01em; text-shadow: 0 1px 0 ${INK}; white-space: nowrap; cursor: pointer; user-select: none; transition: color 140ms var(--bx-ease), transform 140ms var(--bx-ease); }
.bx .bx-btn::before { content: '\\203A'; font: 400 15px/1 var(--bx-f-num); color: ${FAINT}; transition: color 140ms var(--bx-ease); }
.bx .bx-btn kbd { font: 400 13px/1 var(--bx-f-num); color: ${QUIET}; }
.bx .bx-btn em { font: 500 11px/1 var(--bx-f-ui); font-style: normal; letter-spacing: 0.14em; color: ${QUIET}; }
.bx .bx-btn.is-take::before, .bx .bx-btn.is-primary::before { color: ${AMBER_T}; }
.bx .bx-btn.is-primary { padding: 9px 20px 9px 16px; border: 1px solid rgba(240, 140, 46, 0.55); border-radius: 2px; background: rgba(240, 140, 46, 0.08); }
.bx .bx-btn.is-primary:hover:not([disabled]), .bx .bx-btn.is-primary:focus-visible { border-color: ${AMBER_T}; background: rgba(240, 140, 46, 0.16); }
.bx .bx-btn.is-quiet { color: ${QUIET}; }
.bx .bx-btn.is-urgent, .bx .bx-btn.is-urgent kbd { color: ${RED_T}; }
.bx .bx-btn:hover:not([disabled]), .bx .bx-btn:focus-visible { color: ${AMBER_T}; transform: translateX(3px); }
.bx .bx-btn:hover:not([disabled])::before, .bx .bx-btn:focus-visible::before { color: ${AMBER_T}; }
.bx .bx-btn:focus-visible { outline: none; text-decoration: underline 1px; text-underline-offset: 5px; }
.bx .bx-btn:active:not([disabled]) { color: ${AMBER_BR}; transform: none; }
.bx .bx-btn[disabled] { color: ${FAINT}; cursor: default; }
.bx .bx-btn[disabled]::before { color: #33373e; }
.bx .bx-btn[disabled] kbd { color: #33373e; }
.bx .bx-btn.is-stranding, .bx .bx-btn.is-stranding kbd, .bx .bx-btn.is-stranding em { color: ${RED_T}; opacity: 0.7; }
.bx .bx-dock { margin: 0; padding: 0 2px; font: 400 15px/1.4 var(--bx-f-num); color: ${QUIET}; }
.bx .bx-dock.is-rough { color: ${AMBER_BR}; }
.bx .bx-dock.is-crash { color: ${RED_T}; }
.bx .bx-hint { contain: inline-size; margin: 0; padding: 0 2px; max-width: 110ch; font: 400 15px/1.5 var(--bx-f-text); color: ${QUIET}; }
.bx .bx-hint b { font-weight: 500; color: ${STEEL_T}; }
.bx .bx-sub { margin: 4px 0 0; padding: 0 2px; font: 500 12px/1 var(--bx-f-ui); letter-spacing: 0.24em; color: ${QUIET}; }
.bx .bx-picks { contain: inline-size; display: flex; flex-wrap: wrap; gap: 8px 22px; }
.bx .bx-pick { flex: 1 1 210px; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto 1fr; align-items: start; gap: 6px 12px; margin: 0; padding: 6px 4px; border: 0; background: none; color: ${WORDS}; text-align: left; cursor: pointer; transition: transform 140ms var(--bx-ease); }
.bx .bx-pick canvas { grid-row: span 2; width: 68px; height: 100px; image-rendering: pixelated; image-rendering: crisp-edges; transition: transform 140ms var(--bx-ease); }
.bx .bx-pick b { margin-top: 12px; font: 500 15px/1 var(--bx-f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--tone, ${AMBER_T}); }
.bx .bx-pick b small { margin-left: 10px; font: 400 13px/1 var(--bx-f-num); letter-spacing: 0; text-transform: none; color: ${QUIET}; }
.bx .bx-pick span { align-self: start; font: 400 14px/1.45 var(--bx-f-text); color: ${QUIET}; }
.bx .bx-pick:hover canvas, .bx .bx-pick:focus-visible canvas { transform: translateY(-3px); }
.bx .bx-pick:hover span, .bx .bx-pick:focus-visible span { color: ${WORDS}; }
.bx .bx-pick:focus-visible { outline: none; }
.bx .bx-pick:focus-visible b { text-decoration: underline 1px; text-underline-offset: 4px; }
@media (max-width: 640px) { .bx .bx-line { font-size: 17px; } .bx .bx-btn { font-size: 16px; } .bx .bx-door { font-size: 10px; } }
@media (prefers-reduced-motion: reduce) { .bx .bx-btn, .bx .bx-btn::before, .bx .bx-door, .bx .bx-pick, .bx .bx-pick canvas { transition: none; } .bx .bx-frame, .bx .bx-air.is-low .bx-pips i.is-home { animation: none; } }`;
    function addStyle() {
        if (document.getElementById('boarding-bx-style')) return;
        const el = document.createElement('style'); el.id = 'boarding-bx-style'; el.textContent = STYLE;
        document.head.appendChild(el);
    }

    /** Scale the picture to fit the window, the same size for the picker's strip and the walk: whole device pixels per art
        pixel when that costs little room, so every dither dot is the same size. */
    function fitCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1, roomW = (window.innerWidth - 2 * FIT_MARGIN) / AW, roomH = (window.innerHeight - 2 * FIT_MARGIN - WALK_CHROME) / AH;
        const room = Math.max(0.25, Math.min(roomW, roomH)), crisp = Math.floor(room * dpr + 0.01) / dpr, scale = crisp >= room * CRISP_MIN_FILL ? crisp : room;
        canvas.style.width = `${canvas.width * scale}px`; canvas.style.height = `${canvas.height * scale}px`;
        const host = canvas.closest('.bx');
        if (host) host.classList.toggle('is-tight', scale < TIGHT_BELOW);                   // a small picture: smaller door labels, so they leave the rooms visible
    }

    // ── screens ──
    const sfx = (name, ...args) => { const audio = window.AudioSystem; if (audio && typeof audio[name] === 'function') audio[name](...args); }; // silent when muted
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const roleOf = member => Object.keys(PERKS).find(tag => (member.tags || []).includes(tag));
    const whoOf = member => (window.MiniCrew && window.MiniCrew.idOf(member.name)) || PORTRAIT_IDS[member.portraitId] || 'cora';
    const toneOf = member => (window.MiniCrew && window.MiniCrew.TONE[whoOf(member)]) || AMBER_T;
    const airFor = (role, dock) => Math.max(1, TANK + ((PERKS[role] || {}).air || 0) - (DOCK_AIR_LOSS[dock.grade] || 0));
    const DOCK_LINES = { soft: '', rough: 'Rough docking. Whoever goes starts with 2 less air.', crash: 'Hard docking. The hull is damaged, and whoever goes starts with 3 less air.' };
    const conditionRule = (L, b, cond) => ({
        DARK: b.role === 'SPECIALIST' ? 'Dark. Her scanner sees fine.' : `Dark. Searching costs ${DARK_EXTRA} more air.`,
        VENTED: `Vented. Walking in costs ${VENT_EXTRA} more air, every time.`,
        UNSTABLE: `Unstable. ${Math.round(L.risk * 100)}% chance of getting hurt if you search.`,
        SEALED: `Sealed. Cutting in costs ${cutCost(b)} air, once.`,
    }[cond]);
    const AURA_QUOTE = /^A\.U\.R\.A\.: "(.*)"$/;                                             // a status line A.U.R.A. says: her name over her words

    function pickerHtml(app, station, age, dock) {
        const cards = app.state.crew.filter(c => c.status === 'HEALTHY').map(member => {
            const role = roleOf(member), perk = PERKS[role] || { text: '' };
            return `<button type="button" class="bx-pick" data-id="${esc(member.id)}" data-who="${esc(whoOf(member))}" style="--tone:${toneOf(member)}">`
                + `<b>${esc(member.name)} <small>${airFor(role, dock)} AIR</small></b><span>${esc(perk.text)}</span></button>`;
        }).join('');
        return `<div class="bx-frame">
            <header class="bx-head"><p class="bx-kicker">BOARDING — SILENT FOR ${age} YEARS</p><h2 class="bx-title">${esc(station.name || 'Unknown station')}</h2></header>
            <div class="bx-screen"><canvas class="bx-canvas" width="${AW}" height="${PICK_H}" aria-hidden="true"></canvas></div>
            ${DOCK_LINES[dock.grade] ? `<p class="bx-dock is-${esc(dock.grade)}">${DOCK_LINES[dock.grade]}</p>` : ''}
            <p class="bx-hint">One person goes in on one tank of air. Every door and every search shows its cost first. The bar marks the air needed to walk back out. <b>Heavy things make that walk cost more.</b> ${station.scanned ? 'Your deep scan mapped every room.' : 'Without a deep scan, you see a room only when you reach its door.'}</p>
            <p class="bx-sub">WHO GOES IN?</p>
            <div class="bx-picks">${cards || '<p class="bx-hint">Nobody is fit to go.</p>'}</div>
            <div class="bx-buttons"><button type="button" class="bx-btn is-quiet bx-cancel">Stay aboard — skip the station</button></div>
        </div>`;
    }

    function walkHtml(member) {
        return `<div class="bx-frame">
            <header class="bx-head"><p class="bx-kicker">BOARDING — ${esc(member.name)} IS INSIDE</p><h2 class="bx-title bx-room"></h2></header>
            <div class="bx-screen"><canvas class="bx-canvas" width="${AW}" height="${AH}" aria-label="The station"></canvas><div class="bx-doors"></div></div>
            <div class="bx-readout"><div class="bx-air"></div><div class="bx-hands"></div></div>
            <div class="bx-talk"><p class="bx-here"></p><div class="bx-voice" aria-live="polite"><p class="bx-who is-empty"><span class="bx-ring" aria-hidden="true"></span><span class="bx-name"></span></p><p class="bx-line is-note"></p></div></div>
            <div class="bx-buttons"><span class="bx-actions"></span><button type="button" class="bx-btn is-quiet bx-guide">Let A.U.R.A. guide</button></div>
        </div>`;
    }

    /** The air: one small tick per unit. Amber ticks are what the walk out costs from here; the brighter mark is where that ends. */
    function airHtml(b, home) {
        const size = Math.max(b.airMax, b.air), spare = b.air - home.cost, heavy = heavyCount(b);
        const pips = Array.from({ length: size }, (_, k) => `<i class="${k >= b.air ? 'is-spent' : k < home.cost ? 'is-home' : 'is-spare'}${k === home.cost - 1 ? ' is-mark' : ''}"></i>`).join('');
        const load = heavy ? ` Carrying ${heavy} heavy: +${heavy * HEAVY_STEP_COST} per room.` : '';
        const note = b.pos === 0 ? `All ${b.air} to spend.` : spare <= 0 ? `Just enough to walk out. Go now.${load}` : `Walk out from here: ${home.cost} air.${load} <b>${spare} to spend.</b>`;
        return `<span class="bx-label">AIR</span><strong>${b.air}<small> / ${b.airMax}</small></strong><span class="bx-pips" aria-hidden="true">${pips}</span><span class="bx-air-note">${note}</span>`;
    }

    function handsHtml(b) {
        const slots = [];
        b.haul.filter(f => f.hands > 0).forEach(f => { for (let k = 0; k < f.hands; k++) slots.push(k ? '<li class="is-more">+</li>' : `<li class="${f.heavy ? 'is-heavy' : ''}">${esc(f.name)}${f.heavy ? '<small>HEAVY</small>' : ''}</li>`); });
        while (slots.length < HANDS) slots.push('<li class="is-free">free</li>');
        const pocket = b.haul.filter(f => f.hands === 0).map(f => f.name);
        return `<span class="bx-label">CARRYING — ${HANDS} HANDS</span><ol class="bx-slots">${slots.join('')}</ol>${pocket.length ? `<span class="bx-pocket">In a pocket: ${esc(pocket.join(', '))}</span>` : ''}`;
    }

    function actionLabel(o) {
        const cost = `<kbd>−${o.cost} AIR</kbd>`;
        if (o.kind === 'take') {
            const why = o.isFull ? 'HANDS FULL' : !o.isSafe ? 'NOT ENOUGH AIR TO GET BACK' : [o.find.heavy && `HEAVY: +${HEAVY_STEP_COST} AIR PER ROOM OUT`, o.risk && `${Math.round(o.risk * 100)}% CHANCE OF GETTING HURT`].filter(Boolean).join(' · ');
            return `Take ${esc(o.find.name)} ${cost}${why ? `<em>${why}</em>` : ''}`;
        }
        if (o.kind === 'record') return `Record the name ${cost}${o.isSafe ? '' : '<em>NOT ENOUGH AIR TO GET BACK</em>'}`;
        return '';
    }

    /** A small loop at 8 fps that draws until the canvas has been attached and then removed (or never attached in time). */
    function runLoop(canvas, frame) {
        const openedAt = performance.now();
        let wasAttached = false, timer = 0;
        (function loop() {
            if (canvas.isConnected) wasAttached = true;
            else if (wasAttached || performance.now() - openedAt > ATTACH_GRACE_MS) return;
            frame();
            timer = setTimeout(loop, TICK_MS);
        })();
        return () => clearTimeout(timer);
    }

    function start(app, station) {
        const age = ageOf(station, app.state.currentSector);
        addStyle();
        // the boarding's dark backdrop goes up first, under the docking camera (both z-index 6000, the docking added later
        // so on top): when the docking fades out, this is already there and the ship never shows between the two
        const overlay = document.createElement('div');
        overlay.className = 'warp-plot boarding bx';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Board the station');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.appendChild(overlay);
        const docking = window.DockingGame ? window.DockingGame.play(app, station) : Promise.resolve({ grade: 'soft', auto: false });
        return docking.then(dock => new Promise(resolve => {
            if (dock.grade !== 'soft') app.state.addLog(dock.grade === 'crash' ? `Hard docking at ${station.name}. The hull took damage.` : `Rough docking at ${station.name}. We scraped the ring.`);
            const L = buildStation({ seed: station.id, sector: app.state.currentSector || 1, age });
            const scene = { seed: artSeed(station.id), rust: rustOf(age), base: null, outside: null, rooms: new Map(), isAboard: false };
            overlay.removeAttribute('aria-hidden');
            overlay.innerHTML = pickerHtml(app, station, age, dock);
            if (window.ChoiceGuard) window.ChoiceGuard.hold(overlay);                       // as every pop-up: no click lands in its first 400 ms
            const close = result => { overlay.classList.add('is-leaving'); setTimeout(() => { overlay.remove(); resolve(result); }, 350); };
            const strip = overlay.querySelector('.bx-canvas'), stripCtx = strip.getContext('2d');
            stripCtx.imageSmoothingEnabled = false;
            fitCanvas(strip);
            const fitter = new ResizeObserver(() => overlay.querySelectorAll('.bx-screen .bx-canvas').forEach(fitCanvas));
            fitter.observe(overlay);
            let tick = 0;
            const stopStrip = runLoop(strip, () => { tick += 1; drawOutside(stripCtx, L, tick, scene); });
            overlay.querySelectorAll('.bx-pick').forEach(btn => btn.prepend(figureCanvas(btn.dataset.who)));
            overlay.querySelector('.bx-cancel').addEventListener('click', () => {
                stopStrip(); fitter.disconnect();
                app.state.addLog('You stay aboard. The station keeps its secrets.');
                close({ reachedCommand: false });
            });
            overlay.querySelectorAll('.bx-pick').forEach(btn => btn.addEventListener('click', () => {
                const member = app.state.crew.find(c => String(c.id) === btn.dataset.id);
                if (!member) return;
                stopStrip();
                walk(app, station, member, { age, dock, overlay, close: result => { fitter.disconnect(); close(result); }, L, scene });
            }));
            const first = overlay.querySelector('.bx-pick, .bx-cancel');
            if (first) first.focus();
        })).catch(err => { overlay.remove(); throw err; });                                  // no docking (or no picker): no backdrop left behind
    }

    function walk(app, station, member, { dock, overlay, close, L, scene }) {
        const role = roleOf(member);
        let b = newRun(L, { role, air: airFor(role, dock), isScanned: !!station.scanned });
        overlay.innerHTML = walkHtml(member);
        sfx('sfxAirlock');
        const el = s => overlay.querySelector(s);
        const canvas = el('.bx-canvas'), ctx = canvas.getContext('2d'), guideBtn = el('.bx-guide');
        ctx.imageSmoothingEnabled = false;
        fitCanvas(canvas);
        const view = { room: 0, ...roomFloor(GRID, L.rooms[0]), isMoving: false, from: null, to: null, moveTick: 0, facing: 1, actUntil: 0, isAboard: false, who: whoOf(member) };
        let tick = 0, isBusy = false, isAuto = false, isOver = false, lastLowAir = -1;

        /** The voice line under the picture: what happened, as a quiet note, or A.U.R.A.'s words under her name. */
        const say = (text, isBad = false) => {
            const quote = AURA_QUOTE.exec(text), whoEl = el('.bx-who'), lineEl = el('.bx-line');
            el('.bx-name').textContent = quote ? 'A.U.R.A.' : '';
            whoEl.classList.toggle('is-empty', !quote);
            lineEl.textContent = quote ? quote[1] : text;
            lineEl.className = `bx-line${quote ? '' : ' is-note'}${isBad ? ' is-bad' : ''}`;
        };
        function refresh() {
            const { list, home } = options(L, b), room = L.rooms[b.pos], info = ROOMS[room.type];
            const isLow = b.pos > 0 && b.air - home.cost <= 1;
            const was = document.activeElement, isRedrawn = !!was && was !== guideBtn && overlay.contains(was);   // a door or choice that had focus is drawn again
            el('.bx-room').textContent = info.name;
            el('.bx-air').innerHTML = airHtml(b, home);
            el('.bx-air').classList.toggle('is-low', isLow);
            const find = room.find && !has(b.taken, b.pos) ? room.find : null;
            el('.bx-here').innerHTML = `${room.cond ? `<span style="color:${COND_COLOR[room.cond]}">${esc(conditionRule(L, b, room.cond))}</span>` : ''}`
                + `<span>${find ? `Here: <b>${esc(find.name)}</b> — ${esc(find.gain)}.` : room.type === 'AIRLOCK' ? esc(info.text) : 'Nothing left to take here.'}</span>`
                + (L.nameRoom === b.pos && !b.isRecorded ? '<span>A name is scratched into the wall.</span>' : '');
            const acts = list.filter(o => o.kind === 'take' || o.kind === 'record').map(o => `<button type="button" class="bx-btn${o.isSafe ? ' is-take' : ''}${!o.isSafe && !o.isFull ? ' is-stranding' : ''}" data-kind="${o.kind}"${o.isSafe && !isAuto ? '' : ' disabled'}>${actionLabel(o)}</button>`);
            acts.push(b.pos === 0 ? `<button type="button" class="bx-btn" data-kind="leave"${isAuto ? ' disabled' : ''}>Step back aboard</button>`
                : `<button type="button" class="bx-btn${isLow ? ' is-urgent' : ''}" data-kind="home"${isAuto ? ' disabled' : ''}>Head back out <kbd>−${home.cost} AIR</kbd></button>`);
            el('.bx-actions').innerHTML = acts.join('');
            el('.bx-actions').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => act(btn.dataset.kind)));
            el('.bx-hands').innerHTML = handsHtml(b);
            el('.bx-doors').innerHTML = doorsHtml(list);
            el('.bx-doors').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => act('move', Number(btn.dataset.to))));
            guideBtn.disabled = isAuto || isOver;
            if (isLow && lastLowAir !== b.air) { lastLowAir = b.air; sfx('sfxLowAir'); }
            if (isRedrawn) refocus(was);
        }

        /** Focus follows a redraw, so the walk can be played from the keyboard: the same door or choice again, else the first way on. */
        function refocus(was) {
            const same = was.dataset.to != null ? `.bx-door[data-to="${was.dataset.to}"]` : `.bx-actions [data-kind="${was.dataset.kind}"]`;
            const next = overlay.querySelector(`${same}:not([disabled])`) || overlay.querySelector('.bx-door:not([disabled]):not(.is-label), .bx-actions button:not([disabled])');
            if (next) next.focus({ preventScroll: true });
        }

        /** Quiet labels over every room the boarder can see; the rooms next door are buttons carrying their cost. */
        function doorsHtml(list) {
            return L.rooms.map(r => {
                if (r.id === b.pos || !has(b.seen, r.id)) return '';
                const isNameUnder = has(b.known, r.id) && L.nameRoom === r.id && (NAME_AT[r.type] || NAME_AT.default)[1] < LABEL_BAND;   // never over the name on the wall
                const box = roomBox(GRID, r), style = `left:${((box.x + box.w * (isNameUnder ? NAME_CLEAR : 0.5)) / AW) * 100}%;top:${((box.y + CEIL + 3) / AH) * 100}%`;
                const name = has(b.known, r.id) ? ROOMS[r.type].name : 'ROOM ?', isJammed = L.jam === doorKey(b.pos, r.id) && !b.isForced;
                const cond = (r.cond ? `<i style="color:${COND_COLOR[r.cond]}">${r.cond}</i>` : '') + (isJammed ? `<i style="color:${AMBER_T}">JAMMED DOOR</i>` : '');
                const move = list.find(o => o.kind === 'move' && o.to === r.id);
                if (!move) return `<span class="bx-door is-label" style="${style}">${esc(name)}${cond}</span>`;
                const cls = `bx-door${move.isSafe ? '' : ' is-stranding'}${move.isHomeward ? ' is-homeward' : ''}`;
                return `<button type="button" class="${cls}" style="${style}" data-to="${r.id}"${move.isSafe && !isAuto && !isBusy ? '' : ' disabled'}>${esc(name)}${cond}<kbd>${move.isSafe ? `−${move.cost} AIR` : 'TOO FAR'}</kbd></button>`;
            }).join('');
        }

        function describe(action, events, before) {
            if (action.kind === 'move') {
                const room = L.rooms[action.to], bits = [];
                if (events.wasSealed) bits.push(`Cut through the seal.`);
                if (events.wasJammed) bits.push('The door was jammed. Forced it open.');
                if (events.isFirstVisit) bits.push(ROOMS[room.type].text);
                if (events.pocket) bits.push(`A spare air canister in a locker. +${POCKET_AIR} air.`);
                if (action.to === L.command && !before.reachedCommand) bits.push('The logs are downloading to the ship.');
                return bits.join(' ') || ROOMS[room.type].name;
            }
            if (action.kind === 'take') {
                const found = `Taken: ${action.find.name}.`;
                if (events.hurt) return `${found} The ceiling gives way. ${member.name} is hurt.`;
                if (events.armour) return `${found} The ceiling gives way. The armour takes it.`;
                return found;
            }
            if (action.kind === 'record') return `Recorded: "${L.wallName}."`;
            return '';
        }

        function act(kind, to) {
            if (isOver || (isBusy && !isAuto)) return;
            const { list, home } = options(L, b);
            if (kind === 'home') { walkHome(home.path); return; }
            const action = list.find(o => o.kind === kind && (kind !== 'move' || o.to === to));
            if (!action || !action.isSafe) return;
            perform(action);
        }

        function perform(action) {
            if (action.kind === 'leave') { finish(true); return; }
            const before = b, result = apply(L, b, action, Math.random);
            b = result.next;
            if (action.kind === 'move') {
                const from = roomFloor(GRID, L.rooms[before.pos]), to = roomFloor(GRID, L.rooms[action.to]);
                Object.assign(view, { isMoving: true, from, to, moveTick: 0, room: action.to, facing: to.x === from.x ? view.facing : Math.sign(to.x - from.x) });
                sfx('sfxFootsteps');
            } else {
                view.actUntil = tick + ACT_TICKS;
                view.facing = action.kind === 'record' ? -1 : 1;                              // to the name (on the left wall), or to the room's things (on the right)
                sfx(result.events.hurt ? 'sfxSeamSplit' : result.events.armour ? 'sfxWarn' : 'sfxSearch');
            }
            if (result.events.pocket) sfx('sfxDiscovery');
            say(describe(action, result.events, before), !!result.events.hurt);
            refresh();
        }

        function walkHome(path) {
            if (!path.length) { finish(true); return; }
            isBusy = true;
            const next = () => {
                if (isOver) return;
                const move = options(L, b).list.find(o => o.kind === 'move' && o.to === path[0]);
                if (!move) { isBusy = false; refresh(); return; }
                path = path.slice(1);
                perform(move);
                if (b.pos === 0) setTimeout(() => finish(true), WALK_STEP_MS); else setTimeout(next, WALK_STEP_MS);
            };
            next();
        }

        function guide() {
            if (isOver || isAuto) return;
            isAuto = true;
            say('A.U.R.A.: "I will guide them, Commander. Safe rooms only."');
            refresh();
            const stepAura = () => {
                if (isOver) return;
                const action = auraAction(L, b);
                if (!action || action.kind === 'leave') { finish(true); return; }
                perform(action);
                setTimeout(stepAura, AURA_STEP_MS);
            };
            setTimeout(stepAura, AURA_STEP_MS);
        }
        guideBtn.addEventListener('click', guide);

        function finish(isSafe) {
            if (isOver) return;
            isOver = true;
            const haul = applyResult(app, station, member, b, isSafe);
            sfx(isSafe ? 'sfxDiscovery' : 'sfxCritical');
            setTimeout(() => showResult(haul), RESULT_DELAY_MS);
        }

        /** Back aboard: the picture stays (they are inside our ship now), A.U.R.A. says what came back. */
        function showResult(haul) {
            view.isAboard = true; scene.isAboard = true;
            el('.bx-kicker').textContent = `BOARDING — ${member.name} IS BACK ABOARD`;
            el('.bx-room').textContent = 'What came back';
            el('.bx-doors').innerHTML = '';
            el('.bx-readout').innerHTML = `<p class="bx-quiet">Air left in the tank: ${b.air}.</p>`;
            el('.bx-talk').innerHTML = `<div class="bx-voice" aria-live="polite"><p class="bx-who"><span class="bx-ring" aria-hidden="true"></span><span class="bx-name">A.U.R.A.</span></p>`
                + `<ul class="bx-haul">${haul.lines.map(line => `<li>${esc(line)}</li>`).join('') || '<li>Nothing. The station was picked clean.</li>'}</ul>`
                + `${haul.hurt ? `<p class="bx-line is-bad">${esc(haul.hurt)}</p>` : ''}</div>`;
            el('.bx-buttons').innerHTML = '<button type="button" class="bx-btn is-primary bx-done">Continue</button>';
            const done = el('.bx-done');
            done.addEventListener('click', () => { stopLoop(); close({ reachedCommand: b.reachedCommand, member }); }, { once: true });
            done.focus();
        }

        /** 8 fps: the boarder walks or climbs room to room over MOVE_TICKS frames. */
        const stopLoop = runLoop(canvas, () => {
            tick += 1;
            if (view.isMoving) {
                view.moveTick += 1;
                const t = Math.min(1, view.moveTick / MOVE_TICKS);
                view.x = view.from.x + (view.to.x - view.from.x) * t; view.y = view.from.y + (view.to.y - view.from.y) * t;
                if (t >= 1) view.isMoving = false;
            }
            draw(ctx, L, b, view, tick, scene);
        });
        say(`${member.name} is in the airlock.`);
        refresh();
        const firstDoor = overlay.querySelector('.bx-door:not([disabled]):not(.is-label)');
        if (firstDoor) firstDoor.focus();
    }

    /** Bring the haul aboard the same way the old walk did, so nothing else in the game has to change. Returns plain lines for the result card. */
    function applyResult(app, station, member, b, isSafe) {
        const state = app.state, share = isSafe ? 1 : 0.5, lines = [];
        const sum = kind => b.haul.filter(f => f.kind === kind).reduce((n, f) => n + (f.amount || 0), 0);
        const salvage = Math.round(sum('salvage') * share), energy = Math.round(sum('energy') * share), data = sum('data');
        const pods = b.haul.filter(f => f.kind === 'pod').length, notes = b.haul.filter(f => f.kind === 'diary').map(f => f.note);
        state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
        state.energy = Math.min(100, state.energy + energy);
        if (salvage) lines.push(`+${salvage} salvage`);
        if (energy) lines.push(`+${energy} energy, from the cell`);
        if (isSafe) {
            b.haul.forEach(f => {
                if (f.kind === 'medkit' && hasItem('MEDKIT')) { state.cargo.push({ ...ITEMS.MEDKIT, acquiredAt: station.name }); lines.push('A medkit, now in the cargo hold'); }
                if (f.kind === 'tech' && hasItem('TECH_FRAGMENT')) { state.cargo.push({ ...ITEMS.TECH_FRAGMENT, acquiredAt: station.name }); lines.push('A piece of working tech, now in the cargo hold'); }
            });
            if (data && state.addColonyKnowledge) { state.addColonyKnowledge(data, true); lines.push(`+${data} data, from the research notes`); }
            if (pods) { state._sleepers = (state._sleepers || 0) + pods; lines.push(`${pods} sleeper pod${pods > 1 ? 's' : ''}, now in the hold. Someone is alive inside.`); }
            notes.forEach(note => { state.addLog(`Diary from ${station.name}: ${note}`); lines.push('A diary. It is in the mission log.'); });
            if (b.isRecorded) {
                const aris = state.crew.find(c => (c.tags || []).includes('MEDIC') && c.status !== 'DEAD');
                state.addLog(aris ? `${aris.name} adds a name to her list: ${b.wallName}.` : `A name from the wall of ${station.name}: ${b.wallName}.`);
                if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                lines.push(`A name from the wall: ${b.wallName}`);
            }
            if (b.reachedCommand) lines.push("The station's logs");
            if (roleOf(member) === 'LEADER') { state.crew.forEach(m => { if (m.status !== 'DEAD' && m.stress > 0) m.stress -= 1; }); lines.push('The crew saw you go first. Everyone is a little calmer.'); }
        }
        let hurt = '';
        if (b.isHurt || !isSafe) { member.status = 'INJURED'; hurt = `${member.name} was hurt and needs rest.`; }
        member.stress = Math.max(0, Math.min(3, (member.stress || 0) + (b.isHurt ? 1 : 0) - (isSafe ? notes.length : 0)));
        state.addLog(`${member.name} returns from ${station.name}: ${lines.slice(0, 4).join(', ') || 'nothing worth taking'}.${hurt ? ` ${member.name} is INJURED.` : ''}`);
        state.emitUpdates();
        if (app.updateCrewStatusDisplay) app.updateCrewStatusDisplay();
        if (app.autoSave) app.autoSave();
        return { lines, hurt };
    }

    window.BoardingParty = {
        start, ageOf,
        internals: { buildStation, newRun, options, apply, homeRoute, auraAction, bestPlan, handsUsed, heavyCount, TANK, HANDS, DOCK_AIR_LOSS, PERKS, ROOMS, draw, BUFFER_W: AW, BUFFER_H: AH }, // internals: for headless play-tests
    };
})();
