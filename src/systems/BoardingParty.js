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
        [60, ['"Day 212. Still no reply from Earth. They said the radio would work."', '"We found a ship just like ours today. Nobody wants to talk about it."']],
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

    // ── drawing: the station cut away, dithered onto small colour ramps, stepped at 8 fps ──
    const BUFFER_W = 320, BUFFER_H = 170, TICK_MS = 125, MOVE_TICKS = 4, WALK_STEP_MS = 520, AURA_STEP_MS = 700;
    const GRID = { x0: 16, y0: 12, pitchX: 76, pitchY: 52, roomW: 58, roomH: 44 };
    const ATTACH_GRACE_MS = 5000, RESULT_DELAY_MS = 500;
    const INK = '#06070a', GREEN = '#74d99a', GREEN_DIM = '#2f5a48', AMBER = '#d9a24a', BONE = '#c4d0c4', RED = '#d85a4e', FROST = '#9fd0e6', GLASS = '#7fd0de';
    const ROOM_RAMP = ['#06070a', '#0c1612', '#142820', '#1f3d31', '#2f5a48', '#4f7d66'];
    const HULL_RAMP = ['#06070a', '#111414', '#1c2120', '#2a302e', '#3d4541'];
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const COND_COLOR = { DARK: '#8a948c', VENTED: FROST, UNSTABLE: AMBER, SEALED: RED };

    const roomBox = r => ({ x: GRID.x0 + r.col * GRID.pitchX, y: GRID.y0 + r.row * GRID.pitchY, w: GRID.roomW, h: GRID.roomH });
    const roomFloor = r => { const box = roomBox(r); return { x: box.x + box.w / 2, y: box.y + box.h - 3 }; };

    /** Ordered dither of tone (0..1) onto a ramp, one buffer pixel at a time: dense grain, never lone dots on black. */
    function shade(ctx, x0, y0, w, h, ramp, toneAt) {
        const top = ramp.length - 1;
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
            const t = Math.max(0, Math.min(1, toneAt(x, y))) * top, lo = Math.floor(t);
            ctx.fillStyle = ramp[(t - lo) * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? Math.min(top, lo + 1) : lo];
            ctx.fillRect(x, y, 1, 1);
        }
    }

    function drawHull(ctx, L, b, tick) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, BUFFER_W, BUFFER_H);
        for (let k = 0; k < 26; k++) { ctx.fillStyle = k % 3 ? GREEN_DIM : BONE; ctx.fillRect((k * 97 + 13) % BUFFER_W, (k * 53 + 7) % BUFFER_H, 2, 2); } // a few 2-px stars
        L.rooms.forEach(r => { const b = roomBox(r); shade(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, HULL_RAMP, (x, y) => 0.55 + 0.2 * Math.sin((x + y) * 0.35)); });
        L.rooms.forEach(r => L.adj[r.id].forEach(n => {                                     // corridors: a hull tube with a dark bore
            if (n < r.id) return;
            const a = roomBox(r), c = roomBox(L.rooms[n]), isFlat = r.row === L.rooms[n].row;
            const x = isFlat ? Math.min(a.x, c.x) + a.w : a.x + a.w / 2 - 9, y = isFlat ? a.y + a.h - 18 : Math.min(a.y, c.y) + a.h;
            const w = isFlat ? GRID.pitchX - GRID.roomW : 18, h = isFlat ? 16 : GRID.pitchY - GRID.roomH;
            shade(ctx, x - (isFlat ? 0 : 3), y - (isFlat ? 3 : 0), w + (isFlat ? 0 : 6), h + (isFlat ? 6 : 0), HULL_RAMP, () => 0.7);
            ctx.fillStyle = '#0a0f0d'; ctx.fillRect(x, y + (isFlat ? 2 : 0), w, h - (isFlat ? 4 : 0));
            const isJamSeen = b.isScanned || has(b.visited, r.id) || has(b.visited, n);   // a jammed door shows once you stand next to it
            if (L.jam === doorKey(r.id, n) && isJamSeen && !b.isForced) { ctx.fillStyle = tick % 4 < 2 ? AMBER : '#5a4520'; ctx.fillRect(x + w / 2 - 2, y, 4, h); }
        }));
        const air = roomBox(L.rooms[0]);                                                       // our ship's nose, docked at the airlock
        ctx.fillStyle = '#8f8a7a'; ctx.fillRect(0, air.y + 8, air.x - 6, air.h - 16);
        ctx.fillStyle = BONE; ctx.fillRect(0, air.y + 8, air.x - 6, 2);
    }

    function drawGlyph(ctx, r, isTaken, tick) {
        const b = roomBox(r), fx = b.x + b.w / 2, fy = b.y + b.h - 3, blink = tick % 8 < 4;
        const box = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
        switch (r.type) {
            case 'AIRLOCK': box(b.x + 3, b.y + 8, 5, b.h - 11, '#5c6058'); box(b.x + 4, b.y + 4, 3, 3, blink ? AMBER : '#5a4520'); break;
            case 'STORES': if (isTaken) { box(fx - 18, fy - 6, 14, 6, '#4a3f28'); box(fx + 2, fy - 6, 14, 6, '#4a3f28'); break; }
                box(fx - 20, fy - 12, 14, 12, '#8f7a4a'); box(fx - 4, fy - 18, 16, 18, '#a88f58'); box(fx + 13, fy - 10, 9, 10, '#8f7a4a'); box(fx - 4, fy - 18, 16, 2, BONE); break;
            case 'POWER': box(fx - 10, fy - 24, 20, 24, '#2a302e');
                if (!isTaken) { box(fx - 6, fy - 20, 12, 16, tick % 6 < 3 ? AMBER : '#b07a30'); box(fx - 6, fy - 20, 12, 2, '#ffe6a0'); } break;
            case 'MEDBAY': box(fx - 20, fy - 7, 18, 4, BONE); box(fx - 20, fy - 3, 2, 3, '#5c6058'); box(fx + 6, fy - 22, 14, 22, '#3d4541');
                if (!isTaken) { box(fx + 11, fy - 18, 4, 12, BONE); box(fx + 7, fy - 14, 12, 4, BONE); } break;
            case 'CREW': [[-20, 16], [-20, 6], [4, 6]].forEach(([dx, dy]) => box(fx + dx, fy - dy - 3, 16, 3, '#8f8a7a')); if (!isTaken) box(fx + 8, fy - 12, 5, 4, BONE); break;
            case 'CRYO': box(fx - 7, fy - 28, 14, 28, '#5c6058'); box(fx - 5, fy - 25, 10, 20, isTaken ? '#0a0f0d' : GLASS);
                if (!isTaken) { box(fx - 2, fy - 22, 4, 4, BONE); box(fx - 3, fy - 17, 6, 10, '#3f8fa0'); box(fx - 5, fy - 27, 10, 1, blink ? GREEN : GREEN_DIM); } break;
            case 'LAB': [-18, -8, 2, 12].forEach((dx, i) => { box(fx + dx, fy - 26, 6, 26, '#2a302e'); box(fx + dx + 2, fy - 22 + (i * 5) % 12, 2, 2, (tick + i) % 4 < 2 ? GREEN : GREEN_DIM); }); break;
            case 'COMMAND': box(fx - 22, fy - 28, 44, 12, '#1c2120'); [-19, -5, 9].forEach((dx, i) => box(fx + dx, fy - 26, 11, 8, (tick + i) % 6 < 4 ? GREEN : GREEN_DIM));
                box(fx - 14, fy - 8, 28, 8, '#3d4541'); if (!isTaken) box(fx - 4, fy - 12, 8, 4, AMBER); break;
            default: box(b.x + 4, b.y + 6, b.w - 8, 2, '#3d4541'); box(b.x + 4, b.y + 11, b.w - 8, 1, '#2a302e');
        }
    }

    function drawCondition(ctx, r, b, tick) {
        const box = roomBox(r);
        if (r.cond === 'VENTED') {                                                             // a hole in the wall, air frosting out of it
            ctx.fillStyle = INK; ctx.fillRect(box.x + box.w - 5, box.y + 6, 5, 8);
            for (let k = 0; k < 6; k++) { ctx.fillStyle = FROST; ctx.fillRect(box.x + box.w - 8 - ((k * 9 + tick * 3) % 40), box.y + 6 + ((k * 7) % 22), 2, 2); }
        } else if (r.cond === 'UNSTABLE') {                                                    // a cracked ceiling that will not hold still
            const j = tick % 2;
            ctx.fillStyle = AMBER;
            for (let k = 0; k < 10; k++) ctx.fillRect(box.x + 6 + k * 5, box.y + 2 + ((k % 2) ? 2 : 0) + j, 5, 1);
        } else if (r.cond === 'SEALED' && !has(b.cut, r.id)) {                                   // a red frame and bolted bars at both doorways until someone cuts in
            ctx.fillStyle = RED;
            ctx.fillRect(box.x, box.y, box.w, 2); ctx.fillRect(box.x, box.y + box.h - 2, box.w, 2);
            [box.x + 1, box.x + box.w - 5].forEach(x => { ctx.fillRect(x, box.y + 2, 4, box.h - 4); for (let y = box.y + 6; y < box.y + box.h - 4; y += 8) ctx.fillRect(x - 1, y, 6, 2); });
        }
    }

    const QUESTION = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..']; // 5 × 7, drawn at 2 px: a room you can see the door of, but not into
    function drawQuestion(ctx, x, y) {
        ctx.fillStyle = GREEN_DIM;
        QUESTION.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(x + rx * 2, y + ry * 2, 2, 2); });
    }

    function drawRooms(ctx, L, b, view, tick) {
        L.rooms.forEach(r => {
            const box = roomBox(r), isSeen = has(b.seen, r.id), isKnown = has(b.known, r.id), isHere = r.id === Math.round(view.room);
            const dark = r.cond === 'DARK' ? 0.35 : 1, lampR = r.cond === 'DARK' ? 16 : 30;
            const base = (isKnown ? 0.34 : isSeen ? 0.2 : 0.03) * dark;
            shade(ctx, box.x, box.y, box.w, box.h, ROOM_RAMP, (x, y) => {
                const lamp = isHere ? Math.max(0, 1 - Math.hypot(x - view.x, y - view.y + 6) / lampR) * 0.62 : 0;
                const floor = (y - box.y) / box.h * (isSeen ? 0.12 : 0.04), fizz = !isSeen && ((x * 7 + y * 13 + tick * 5) % 23 === 0) ? 0.3 : 0;
                return base + floor + lamp + fizz;
            });
            if (isKnown) drawGlyph(ctx, r, has(b.taken, r.id), tick);
            else if (isSeen) drawQuestion(ctx, box.x + box.w / 2 - 5, box.y + 16);
            if (isSeen) drawCondition(ctx, r, b, tick);
            ctx.strokeStyle = isHere ? BONE : isSeen ? GREEN_DIM : '#16211c';
            ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
            if (has(b.taken, r.id) && r.type !== 'AIRLOCK') { ctx.fillStyle = GREEN; ctx.fillRect(box.x + 3, box.y + 3, 4, 4); }
        });
    }

    /** The way out, as amber dashes from the boarder back to the airlock. */
    function drawHomePath(ctx, L, b, view, tick) {
        const path = homeRoute(L, b).path;
        if (!path.length) return;
        let from = { x: view.x, y: view.y - 1 };
        ctx.fillStyle = AMBER;
        path.forEach(id => {
            const to = roomFloor(L.rooms[id]), steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4);
            for (let k = 0; k < steps; k++) if ((k + tick) % 3) ctx.fillRect(Math.round(from.x + (to.x - from.x) * k / steps), Math.round(from.y + (to.y - from.y) * k / steps) - 1, 2, 1);
            from = to;
        });
    }

    function drawBoarder(ctx, b, view, color, tick) {
        const x = Math.round(view.x) - 3, y = Math.round(view.y) - 13, step = view.isMoving ? tick % 2 : 0;
        if (b.haul.some(f => f.kind === 'pod')) { ctx.fillStyle = '#5c6058'; ctx.fillRect(x - 9, y + 1, 7, 12); ctx.fillStyle = GLASS; ctx.fillRect(x - 8, y + 3, 5, 6); }
        if (b.haul.some(f => f.kind === 'energy')) { ctx.fillStyle = AMBER; ctx.fillRect(x - 3, y + 5, 3, 5); }
        ctx.fillStyle = BONE; ctx.fillRect(x + 1, y, 5, 5);
        ctx.fillStyle = '#1d5563'; ctx.fillRect(x + 3, y + 1, 3, 2);
        ctx.fillStyle = color; ctx.fillRect(x, y + 5, 7, 5);
        ctx.fillRect(x + 1, y + 10, 2, 3 - step); ctx.fillRect(x + 4, y + 10 + step, 2, 3 - step);
        if (b.isHurt) { ctx.fillStyle = tick % 4 < 2 ? RED : '#6a2f2a'; ctx.fillRect(x + 7, y - 2, 2, 2); }
    }

    function draw(ctx, L, b, view, color, tick) {
        drawHull(ctx, L, b, tick);
        drawRooms(ctx, L, b, view, tick);
        if (!view.isMoving) drawHomePath(ctx, L, b, view, tick);
        drawBoarder(ctx, b, view, color, tick);
    }

    // ── screens ──
    const sfx = (name, ...args) => { const audio = window.AudioSystem; if (audio && typeof audio[name] === 'function') audio[name](...args); }; // silent when muted
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const roleOf = member => Object.keys(PERKS).find(tag => (member.tags || []).includes(tag));
    const colorOf = member => (window.ShipCutaway ? `rgb(${window.ShipCutaway.colorOf(member).join(',')})` : BONE);
    const airFor = (role, dock) => Math.max(1, TANK + ((PERKS[role] || {}).air || 0) - (DOCK_AIR_LOSS[dock.grade] || 0));
    const DOCK_LINES = { soft: '', rough: 'Rough docking. Whoever goes starts with 2 less air.', crash: 'Hard docking. The hull is damaged, and whoever goes starts with 3 less air.' };
    const conditionRule = (L, b, cond) => ({
        DARK: b.role === 'SPECIALIST' ? 'Dark. Her scanner sees fine.' : `Dark. Searching costs ${DARK_EXTRA} more air.`,
        VENTED: `Vented. Walking in costs ${VENT_EXTRA} more air, every time.`,
        UNSTABLE: `Unstable. ${Math.round(L.risk * 100)}% chance of getting hurt if you search.`,
        SEALED: `Sealed. Cutting in costs ${cutCost(b)} air, once.`,
    }[cond]);

    function pickerHtml(app, station, age, dock) {
        const cards = app.state.crew.filter(c => c.status === 'HEALTHY').map(member => {
            const role = roleOf(member), perk = PERKS[role] || { text: '' };
            return `<button class="boarding-pick" data-id="${esc(member.id)}" style="border-left-color:${colorOf(member)}">`
                + `<img src="assets/crew/${esc(member.portraitId)}.png" alt=""><b>${esc(member.name)} <small>${airFor(role, dock)} AIR</small></b><span>${esc(perk.text)}</span></button>`;
        }).join('');
        return `<p class="warp-plot-kicker">BOARDING — SILENT FOR ${age} YEARS</p>
            <h2 class="warp-plot-target">${esc(station.name || 'Unknown station')}</h2>
            ${DOCK_LINES[dock.grade] ? `<p class="boarding-dock is-${esc(dock.grade)}">${DOCK_LINES[dock.grade]}</p>` : ''}
            <p class="warp-plot-hint">One person goes in on one tank of air. Every door and every search shows its cost first. The bar marks the air needed to walk back out. <b>Heavy things make that walk cost more.</b> ${station.scanned ? 'Your deep scan mapped every room.' : 'Without a deep scan, you see a room only when you reach its door.'}</p>
            <h4 class="boarding-subhead">WHO GOES IN?</h4>
            <div class="boarding-picker">${cards || '<p class="warp-plot-hint">Nobody is fit to go.</p>'}</div>
            <div class="warp-plot-buttons"><button class="warp-plot-auto boarding-cancel">STAY ABOARD — skip the station</button></div>`;
    }

    function walkHtml(member) {
        return `<p class="warp-plot-kicker">BOARDING — ${esc(member.name)} IS INSIDE</p>
            <h2 class="warp-plot-target boarding-room-name"></h2>
            <div class="boarding-layout">
                <div class="boarding-map"><canvas class="warp-plot-canvas boarding-canvas" width="${BUFFER_W}" height="${BUFFER_H}"></canvas><div class="boarding-doors"></div></div>
                <div class="boarding-side">
                    <div class="boarding-air"></div>
                    <div class="boarding-here"></div>
                    <div class="warp-plot-buttons boarding-actions"></div>
                    <div class="boarding-hands"></div>
                </div>
            </div>
            <p class="boarding-status" aria-live="polite"></p>
            <div class="warp-plot-buttons"><button class="warp-plot-auto boarding-guide">LET A.U.R.A. GUIDE</button></div>`;
    }

    /** The air gauge: one block per unit. Amber blocks are what the walk out costs from here; a bright tick marks where that ends. */
    function airHtml(b, home) {
        const size = Math.max(b.airMax, b.air), spare = b.air - home.cost, heavy = heavyCount(b);
        const pips = Array.from({ length: size }, (_, k) => `<i class="${k >= b.air ? 'is-spent' : k < home.cost ? 'is-home' : 'is-spare'}${k === home.cost - 1 ? ' is-mark' : ''}"></i>`).join('');
        const load = heavy ? ` Carrying ${heavy} heavy: +${heavy * HEAVY_STEP_COST} per room.` : '';
        const note = b.pos === 0 ? `All ${b.air} to spend.` : spare <= 0 ? `Just enough to walk out. Go now.${load}` : `Walk out from here: ${home.cost} air.${load} <b>${spare} to spend.</b>`;
        return `<div class="boarding-air-head"><span>AIR</span><strong>${b.air}<small> / ${b.airMax}</small></strong></div><div class="boarding-air-pips">${pips}</div><p class="boarding-air-note">${note}</p>`;
    }

    function handsHtml(b) {
        const slots = [];
        b.haul.filter(f => f.hands > 0).forEach(f => { for (let k = 0; k < f.hands; k++) slots.push(`<li class="${f.heavy ? 'is-heavy' : ''}">${k ? '' : esc(f.name)}${!k && f.heavy ? ' <small>HEAVY</small>' : ''}</li>`); });
        while (slots.length < HANDS) slots.push('<li class="is-free">free</li>');
        const pocket = b.haul.filter(f => f.hands === 0).map(f => f.name);
        return `<h4 class="boarding-subhead">CARRYING — ${HANDS} HANDS</h4><ol class="boarding-slots">${slots.join('')}</ol>${pocket.length ? `<p class="boarding-pocket">In a pocket: ${esc(pocket.join(', '))}</p>` : ''}`;
    }

    function actionLabel(o) {
        const cost = `<kbd>−${o.cost} AIR</kbd>`;
        if (o.kind === 'take') {
            const why = o.isFull ? 'HANDS FULL' : !o.isSafe ? 'NOT ENOUGH AIR TO GET BACK' : [o.find.heavy && `HEAVY: +${HEAVY_STEP_COST} AIR PER ROOM OUT`, o.risk && `${Math.round(o.risk * 100)}% CHANCE OF GETTING HURT`].filter(Boolean).join(' · ');
            return `TAKE ${esc(o.find.name.toUpperCase())} ${cost}${why ? `<em>${why}</em>` : ''}`;
        }
        if (o.kind === 'record') return `RECORD THE NAME ${cost}${o.isSafe ? '' : '<em>NOT ENOUGH AIR TO GET BACK</em>'}`;
        return '';
    }

    function start(app, station) {
        const age = ageOf(station, app.state.currentSector);
        const docking = window.DockingGame ? window.DockingGame.play(app, station) : Promise.resolve({ grade: 'soft', auto: false });
        return docking.then(dock => new Promise(resolve => {
            if (dock.grade !== 'soft') app.state.addLog(dock.grade === 'crash' ? `Hard docking at ${station.name}. The hull took damage.` : `Rough docking at ${station.name}. We scraped the ring.`);
            const overlay = document.createElement('div');
            overlay.className = 'warp-plot boarding';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-label', 'Board the station');
            overlay.innerHTML = `<div class="warp-plot-frame">${pickerHtml(app, station, age, dock)}</div>`;
            document.body.appendChild(overlay);
            const frame = overlay.querySelector('.warp-plot-frame');
            const close = result => { overlay.classList.add('is-leaving'); setTimeout(() => { overlay.remove(); resolve(result); }, 350); };
            overlay.querySelector('.boarding-cancel').addEventListener('click', () => {
                app.state.addLog('You stay aboard. The station keeps its secrets.');
                close({ reachedCommand: false });
            });
            overlay.querySelectorAll('.boarding-pick').forEach(btn => btn.addEventListener('click', () => {
                const member = app.state.crew.find(c => String(c.id) === btn.dataset.id);
                if (member) walk(app, station, member, { age, dock, frame, close });
            }));
            const first = overlay.querySelector('.boarding-pick, .boarding-cancel');
            if (first) first.focus();
        }));
    }

    function walk(app, station, member, { age, dock, frame, close }) {
        const role = roleOf(member), color = colorOf(member);
        const L = buildStation({ seed: station.id, sector: app.state.currentSector || 1, age });
        let b = newRun(L, { role, air: airFor(role, dock), isScanned: !!station.scanned });
        frame.innerHTML = walkHtml(member);
        sfx('sfxAirlock');
        const el = s => frame.querySelector(s);
        const canvas = el('canvas'), ctx = canvas.getContext('2d'), statusEl = el('.boarding-status'), guideBtn = el('.boarding-guide');
        const view = { room: 0, ...roomFloor(L.rooms[0]), isMoving: false, from: null, to: null, moveTick: 0 };
        let tick = 0, isBusy = false, isAuto = false, isOver = false, lastLowAir = -1, timer = 0;
        const openedAt = performance.now();
        let wasAttached = false;

        const say = text => { statusEl.textContent = text; };
        function refresh() {
            const { list, home } = options(L, b), room = L.rooms[b.pos], info = ROOMS[room.type];
            el('.boarding-room-name').textContent = info.name;
            el('.boarding-air').innerHTML = airHtml(b, home);
            el('.boarding-air').classList.toggle('is-low', b.pos > 0 && b.air - home.cost <= 1);
            const find = room.find && !has(b.taken, b.pos) ? room.find : null;
            el('.boarding-here').innerHTML = `${room.cond ? `<p class="boarding-cond" style="color:${COND_COLOR[room.cond]}">${esc(conditionRule(L, b, room.cond))}</p>` : ''}`
                + `<p class="boarding-find">${find ? `Here: <b>${esc(find.name)}</b> — ${esc(find.gain)}.` : room.type === 'AIRLOCK' ? esc(info.text) : 'Nothing left to take here.'}</p>`
                + (L.nameRoom === b.pos && !b.isRecorded ? '<p class="boarding-find">A name is scratched into the wall.</p>' : '');
            const isLow = b.pos > 0 && b.air - home.cost <= 1;
            const acts = list.filter(o => o.kind === 'take' || o.kind === 'record').map(o => `<button class="warp-plot-engage${!o.isSafe && !o.isFull ? ' is-stranding' : ''}" data-kind="${o.kind}"${o.isSafe && !isAuto ? '' : ' disabled'}>${actionLabel(o)}</button>`);
            acts.push(b.pos === 0 ? `<button class="warp-plot-auto" data-kind="leave"${isAuto ? ' disabled' : ''}>STEP BACK ABOARD</button>`
                : `<button class="warp-plot-auto boarding-out${isLow ? ' is-urgent' : ''}" data-kind="home"${isAuto ? ' disabled' : ''}>HEAD BACK OUT <kbd>−${home.cost} AIR</kbd></button>`);
            el('.boarding-actions').innerHTML = acts.join('');
            el('.boarding-actions').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => act(btn.dataset.kind)));
            el('.boarding-hands').innerHTML = handsHtml(b);
            el('.boarding-doors').innerHTML = doorsHtml(list);
            el('.boarding-doors').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => act('move', Number(btn.dataset.to))));
            guideBtn.disabled = isAuto || isOver;
            if (b.pos > 0 && b.air - home.cost <= 1 && lastLowAir !== b.air) { lastLowAir = b.air; sfx('sfxLowAir'); }
        }

        /** Labels over every room the boarder can see; the rooms next door are buttons carrying their cost. */
        function doorsHtml(list) {
            return L.rooms.map(r => {
                if (r.id === b.pos || !has(b.seen, r.id)) return '';
                const box = roomBox(r), style = `left:${(box.x + box.w / 2) / BUFFER_W * 100}%;top:${(box.y + 2) / BUFFER_H * 100}%`;
                const name = has(b.known, r.id) ? ROOMS[r.type].name : 'ROOM ?', isJammed = L.jam === doorKey(b.pos, r.id) && !b.isForced;
                const cond = (r.cond ? `<i style="color:${COND_COLOR[r.cond]}">${r.cond}</i>` : '') + (isJammed ? `<i style="color:${AMBER}">JAMMED DOOR</i>` : '');
                const move = list.find(o => o.kind === 'move' && o.to === r.id);
                if (!move) return `<span class="boarding-door is-label" style="${style}">${esc(name)}${cond}</span>`;
                const cls = `boarding-door${move.isSafe ? '' : ' is-stranding'}${move.isHomeward ? ' is-homeward' : ''}`;
                return `<button class="${cls}" style="${style}" data-to="${r.id}"${move.isSafe && !isAuto && !isBusy ? '' : ' disabled'}>${esc(name)}${cond}<kbd>${move.isSafe ? `−${move.cost} AIR` : 'TOO FAR'}</kbd></button>`;
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
                Object.assign(view, { isMoving: true, from: roomFloor(L.rooms[before.pos]), to: roomFloor(L.rooms[action.to]), moveTick: 0, room: action.to });
                sfx('sfxFootsteps');
            } else sfx(result.events.hurt ? 'sfxSeamSplit' : result.events.armour ? 'sfxWarn' : 'sfxSearch');
            if (result.events.pocket) sfx('sfxDiscovery');
            statusEl.classList.toggle('is-bad', !!result.events.hurt);
            say(describe(action, result.events, before));
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

        function showResult(haul) {
            clearTimeout(timer);
            frame.parentElement.classList.add('is-result');
            frame.innerHTML = `<p class="warp-plot-kicker">BOARDING — ${esc(member.name)} IS BACK ABOARD</p>
                <h2 class="warp-plot-target">What came back</h2>
                <ul class="boarding-haul">${haul.lines.map(line => `<li>${esc(line)}</li>`).join('') || '<li>Nothing. The station was picked clean.</li>'}</ul>
                ${haul.hurt ? `<p class="boarding-status is-bad">${esc(haul.hurt)}</p>` : ''}
                <p class="boarding-air-note">Air left in the tank: ${b.air}.</p>
                <div class="warp-plot-buttons"><button class="warp-plot-engage boarding-done">CONTINUE</button></div>`;
            const done = frame.querySelector('.boarding-done');
            done.addEventListener('click', () => close({ reachedCommand: b.reachedCommand, member }), { once: true });
            done.focus();
        }

        /** 8 fps: the boarder drifts room to room over MOVE_TICKS frames. Stops once the canvas has been attached and then removed (or never attached after a grace period). */
        (function loop() {
            if (canvas.isConnected) wasAttached = true;
            else if (wasAttached || performance.now() - openedAt > ATTACH_GRACE_MS) return;
            tick += 1;
            if (view.isMoving) {
                view.moveTick += 1;
                const t = Math.min(1, view.moveTick / MOVE_TICKS);
                view.x = view.from.x + (view.to.x - view.from.x) * t; view.y = view.from.y + (view.to.y - view.from.y) * t;
                if (t >= 1) view.isMoving = false;
            }
            draw(ctx, L, b, view, color, tick);
            timer = setTimeout(loop, TICK_MS);
        })();
        say(`${member.name} is in the airlock.`);
        refresh();
        const firstDoor = frame.querySelector('.boarding-door:not([disabled])');
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
        internals: { buildStation, newRun, options, apply, homeRoute, auraAction, bestPlan, handsUsed, heavyCount, TANK, HANDS, DOCK_AIR_LOSS, PERKS, ROOMS, draw, BUFFER_W, BUFFER_H }, // internals: for headless play-tests
    };
})();
