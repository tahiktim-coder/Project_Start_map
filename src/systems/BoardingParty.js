/* BoardingParty — boarding an old station is a push-your-luck walk on a tank of air.
   One crew member goes in. Seven rooms in a line, airlock first, command deck last.
   Going one room deeper costs 1 oxygen, searching a room costs 2, and walking out costs 1 per room
   between you and the airlock — so every step in is also a step you must pay for on the way back.
   Deeper rooms hold more, and bite more. Run out of air and you are dragged out hurt, with half of it.
   Who you send matters (one perk each). A deep scan from orbit maps the rooms before you go in.
   start(app, station) → Promise<{ reachedCommand: boolean }> */

(function () {
    'use strict';

    const BUFFER_W = 320, BUFFER_H = 84, ROOM_W = 42, ROOM_H = 46, ROOM_Y = 20, ROOM_X0 = 13;
    const BASE_OXYGEN = 10, MOVE_COST = 1, SEARCH_COST = 2;
    const HAZARD_BASE = 0.10, HAZARD_PER_ROOM = 0.08, BREACH_LOSS = 2;
    const SECTOR_AGE_YEARS = [20, 20, 100, 200, 250, 320, 400]; // index = sector; wrecks get older the further you go
    const INK = '#06070a', GREEN = '#74d99a', GREEN_DIM = '#2f5a48', GREEN_DARK = '#142820', AMBER = '#d9a24a', BONE = '#c4d0c4', RED = '#d85a4e';

    const ROOMS = {
        AIRLOCK: { name: 'AIRLOCK', text: 'Your way in, and your only way out.' },
        CORRIDOR: { name: 'CORRIDOR', text: 'Loose cables drift in the dark.' },
        STORES: { name: 'STORES', text: 'Shelves of sealed crates.' },
        QUARTERS: { name: 'CREW QUARTERS', text: 'Bunks. Somebody lived here.' },
        LAB: { name: 'LABORATORY', text: 'Instruments still blinking on backup power.' },
        REACTOR: { name: 'REACTOR ROOM', text: 'Warm. It should not still be warm.' },
        COMMAND: { name: 'COMMAND DECK', text: "The station's logs are kept here." },
    };
    const PERKS = {
        ENGINEER: { text: 'Knows machines — nothing goes wrong for him in the reactor room.' },
        MEDIC: { text: 'Steady breathing — starts with 2 extra oxygen.', oxygen: 2 },
        SECURITY: { text: 'Armoured suit — the first thing that goes wrong does nothing.' },
        SPECIALIST: { text: 'Reads the floor plan — always sees what the next room is.' },
        LEADER: { text: 'No trick. But the crew notices who goes first: everyone calms down if she makes it back.' },
    };
    const QUARTERS_LOGS = [ // [max age in years, lines] — first bracket that fits the station's age
        [60, ['"Day 212. Still no reply from Earth. They said the radio would work."', '"We found a ship just like ours today. Nobody wants to talk about it."']],
        [160, ['"They told us we were the first. We passed four wrecks before breakfast."', '"The mission patch in locker 3 has a number on it. A very big number."']],
        [260, ['"The ship keeps steering us. Nobody set this course."', '"It is not a planet we are looking for. I am sure of that now."']],
        [9999, ['"We stopped chasing it. We are going to build something it cannot miss."', '"If you are reading this, you were faster than us. Good. Keep going, or don\'t."']],
    ];
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    function seeded(id) {
        let s = 7;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    /** How long ago this station went quiet. Fixed per station; older in deeper sectors. */
    function ageOf(station, sector) {
        const base = SECTOR_AGE_YEARS[Math.max(1, Math.min(6, sector || 1))];
        return Math.round(base * (0.85 + seeded(station && station.id)() * 0.3));
    }

    function layout(station) {
        const rand = seeded(station.id), middle = ['CORRIDOR', 'STORES', 'QUARTERS', 'LAB', 'REACTOR'];
        for (let i = middle.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [middle[i], middle[j]] = [middle[j], middle[i]]; }
        return ['AIRLOCK', ...middle, 'COMMAND'].map(type => ({ type, isSearched: type === 'AIRLOCK', isKnown: type === 'AIRLOCK' }));
    }

    const roleOf = member => Object.keys(PERKS).find(tag => (member.tags || []).includes(tag));
    const range = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

    // ── what a search turns up ──
    function searchRoom(b) {
        const room = b.rooms[b.pos], c = b.carried;
        switch (room.type) {
            case 'STORES': { const n = range(12, 28); c.salvage += n; return `Sealed crates. +${n} salvage.`; }
            case 'REACTOR': { const n = range(10, 20); c.energy += n; return `A charged cell, still good. +${n} energy.`; }
            case 'COMMAND': { const n = range(20, 35); c.salvage += n; b.reachedCommand = true; return `The station core, and its logs. +${n} salvage. The logs are downloading…`; }
            case 'LAB':
                if (Math.random() < 0.35 && typeof ITEMS !== 'undefined' && ITEMS.TECH_FRAGMENT) { c.items.push(ITEMS.TECH_FRAGMENT); return 'A working piece of old tech. Taken.'; }
                c.data += 1; return 'Research notes on a failed landing. +1 data.';
            case 'QUARTERS': {
                const lines = QUARTERS_LOGS.find(([maxAge]) => b.age <= maxAge)[1];
                c.notes.push(lines[Math.floor(Math.random() * lines.length)]); c.calm += 1;
                return 'A diary, taped under a bunk. You take it with you.';
            }
            default: if (Math.random() < 0.4) { const n = range(3, 8); c.salvage += n; return `Scrap in a wall panel. +${n} salvage.`; } return 'Nothing but dust.';
        }
    }

    function rollHazard(b) {
        const room = b.rooms[b.pos];
        if (Math.random() >= HAZARD_BASE + HAZARD_PER_ROOM * b.pos) return null;
        if (b.role === 'ENGINEER' && room.type === 'REACTOR') return 'A valve starts to blow — he closes it without looking.';
        if (b.role === 'SECURITY' && !b.isArmourSpent) { b.isArmourSpent = true; return 'A panel bursts. The armour takes it. Nothing lost.'; }
        if (Math.random() < 0.6) { b.oxygen = Math.max(0, b.oxygen - BREACH_LOSS); return `A seam splits! −${BREACH_LOSS} oxygen.`; }
        b.shaken += 1; return 'Something moves in the dark. Probably a cable. Stress +1.';
    }

    // ── drawing ──
    function drawGlyph(ctx, type, x, y) { // tiny furniture so rooms read at a glance
        ctx.fillStyle = GREEN_DIM;
        if (type === 'STORES') { ctx.fillRect(x + 6, y + 28, 10, 10); ctx.fillRect(x + 18, y + 22, 12, 16); ctx.fillRect(x + 31, y + 30, 6, 8); }
        else if (type === 'QUARTERS') { ctx.fillRect(x + 5, y + 18, 14, 3); ctx.fillRect(x + 5, y + 30, 14, 3); ctx.fillRect(x + 24, y + 30, 13, 3); }
        else if (type === 'LAB') { [9, 19, 29].forEach(dx => ctx.fillRect(x + dx, y + 14, 4, 24)); }
        else if (type === 'REACTOR') { ctx.fillStyle = AMBER; ctx.fillRect(x + 14, y + 16, 14, 14); ctx.fillStyle = GREEN_DIM; ctx.strokeStyle = GREEN_DIM; ctx.strokeRect(x + 11.5, y + 13.5, 19, 19); }
        else if (type === 'COMMAND') { ctx.fillRect(x + 6, y + 10, 30, 8); ctx.fillRect(x + 10, y + 30, 22, 8); ctx.fillStyle = BONE; ctx.fillRect(x + 12, y + 32, 2, 2); ctx.fillRect(x + 18, y + 32, 2, 2); }
        else if (type === 'AIRLOCK') { ctx.fillRect(x + 3, y + 12, 4, 26); ctx.fillStyle = AMBER; ctx.fillRect(x + 4, y + 8, 2, 2); }
        else { ctx.fillRect(x + 4, y + 8, 34, 2); ctx.fillRect(x + 4, y + 13, 34, 1); }
    }

    function draw(ctx, b, now) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, BUFFER_W, BUFFER_H);
        b.rooms.forEach((room, i) => {
            const x = ROOM_X0 + i * ROOM_W, isHere = i === b.pos;
            ctx.fillStyle = room.isKnown ? (isHere ? '#1b3329' : GREEN_DARK) : '#0a0f0d';
            ctx.fillRect(x, ROOM_Y, ROOM_W - 2, ROOM_H);
            if (room.isKnown) drawGlyph(ctx, room.type, x, ROOM_Y);
            else for (let k = 0; k < 5; k++) { ctx.fillStyle = '#16211c'; ctx.fillRect(x + 6 + k * 7, ROOM_Y + 8 + ((k * 13) % 24), 3, 3); } // unexplored: static
            ctx.strokeStyle = isHere ? BONE : GREEN_DIM;
            ctx.strokeRect(x + 0.5, ROOM_Y + 0.5, ROOM_W - 3, ROOM_H - 1);
            ctx.fillStyle = INK; ctx.fillRect(x + ROOM_W - 3, ROOM_Y + ROOM_H - 16, 3, 12);                     // doorway to the next room
            if (room.isSearched && room.type !== 'AIRLOCK') { ctx.fillStyle = GREEN; ctx.fillRect(x + 3, ROOM_Y + 3, 4, 4); } // searched mark
        });
        const fx = ROOM_X0 + b.pos * ROOM_W + 18, fy = ROOM_Y + ROOM_H - 2, step = Math.floor(now / 300) % 2; // the boarder
        ctx.fillStyle = BONE; ctx.fillRect(fx, fy - 9, 3, 3);
        ctx.fillStyle = b.color; ctx.fillRect(fx - 1, fy - 6, 5, 4); ctx.fillRect(fx, fy - 2, 1, 2); ctx.fillRect(fx + 2, fy - 2 + step, 1, 2 - step);
        for (let k = 0; k < b.oxygenMax; k++) {                                                                  // oxygen pips; the ones you need to get home are amber
            const isFull = k < b.oxygen, isReturnTrip = k < b.pos * MOVE_COST;
            ctx.fillStyle = isFull ? (isReturnTrip ? AMBER : GREEN) : '#1a1f1d';
            if (isFull && b.oxygen <= b.pos && Math.floor(now / 250) % 2) ctx.fillStyle = RED;
            ctx.fillRect(ROOM_X0 + k * 12, 6, 10, 6);
        }
    }

    // ── screens ──
    function pickerHtml(app, station, age) {
        const cut = window.ShipCutaway;
        const cards = app.state.crew.filter(c => c.status === 'HEALTHY').map(member => {
            const role = roleOf(member), perk = PERKS[role] || { text: '' }, color = cut ? `rgb(${cut.colorOf(member).join(',')})` : 'var(--bone)';
            return `<button class="boarding-pick" data-id="${esc(member.id)}" style="border-left-color:${color}">`
                + `<img src="assets/crew/${esc(member.portraitId)}.png" alt=""><b>${esc(member.name)}</b><span>${esc(perk.text)}</span></button>`;
        }).join('');
        return `<p class="warp-plot-kicker">BOARDING — SILENT FOR ${age} YEARS</p>
            <h2 class="warp-plot-target">${esc(station.name || 'Unknown station')}</h2>
            <p class="warp-plot-hint">One person goes in, on one tank of air. Going deeper costs 1 oxygen, searching a room costs 2, and every room you enter is a room you must walk back through. The best finds are at the far end.${station.scanned ? ' <b>Your deep scan mapped every room.</b>' : ' A deep scan from orbit would have shown the rooms first.'}</p>
            <h4 class="boarding-subhead">WHO GOES IN?</h4>
            <div class="boarding-picker">${cards || '<p class="warp-plot-hint">Nobody is fit to go.</p>'}</div>
            <div class="warp-plot-buttons"><button class="warp-plot-auto boarding-cancel">STAY ABOARD — skip the station</button></div>`;
    }

    function walkHtml(b) {
        return `<p class="warp-plot-kicker">BOARDING — ${esc(b.member.name)} IS INSIDE</p>
            <h2 class="warp-plot-target boarding-room-name"></h2>
            <canvas class="warp-plot-canvas" width="${BUFFER_W}" height="${BUFFER_H}"></canvas>
            <p class="boarding-status" aria-live="polite"></p>
            <div class="warp-plot-buttons boarding-actions">
                <button class="warp-plot-engage" data-act="deeper">GO DEEPER <kbd>−${MOVE_COST} O₂</kbd></button>
                <button class="warp-plot-engage boarding-search" data-act="search">SEARCH ROOM <kbd>−${SEARCH_COST} O₂</kbd></button>
                <button class="warp-plot-auto" data-act="leave">HEAD BACK</button>
            </div>
            <p class="boarding-carried"></p>`;
    }

    function start(app, station) {
        return new Promise(resolve => {
            const age = ageOf(station, app.state.currentSector);
            const overlay = document.createElement('div');
            overlay.className = 'warp-plot boarding';
            overlay.innerHTML = `<div class="warp-plot-frame">${pickerHtml(app, station, age)}</div>`;
            document.body.appendChild(overlay);
            const frame = overlay.querySelector('.warp-plot-frame');
            const close = result => { overlay.classList.add('is-leaving'); setTimeout(() => { overlay.remove(); resolve(result); }, 350); };

            overlay.querySelector('.boarding-cancel').addEventListener('click', () => {
                app.state.addLog('You stay aboard. The station keeps its secrets.');
                close({ reachedCommand: false });
            });
            overlay.querySelectorAll('.boarding-pick').forEach(btn => btn.addEventListener('click', () => {
                const member = app.state.crew.find(c => String(c.id) === btn.dataset.id);
                if (member) walk(app, station, member, age, frame, close);
            }));
        });
    }

    function walk(app, station, member, age, frame, close) {
        const role = roleOf(member), cut = window.ShipCutaway, oxygenMax = BASE_OXYGEN + ((PERKS[role] || {}).oxygen || 0);
        const b = {
            member, role, age, rooms: layout(station), pos: 0, oxygen: oxygenMax, oxygenMax, reachedCommand: false, isArmourSpent: false, shaken: 0,
            color: cut ? `rgb(${cut.colorOf(member).join(',')})` : BONE, carried: { salvage: 0, energy: 0, data: 0, calm: 0, items: [], notes: [] },
        };
        if (station.scanned) b.rooms.forEach(r => { r.isKnown = true; });
        frame.innerHTML = walkHtml(b);
        const ctx = frame.querySelector('canvas').getContext('2d'), statusEl = frame.querySelector('.boarding-status');
        const nameEl = frame.querySelector('.boarding-room-name'), carriedEl = frame.querySelector('.boarding-carried');
        const buttons = { deeper: frame.querySelector('[data-act="deeper"]'), search: frame.querySelector('[data-act="search"]'), leave: frame.querySelector('[data-act="leave"]') };
        let raf = 0, isOver = false;

        function refresh(message) {
            const room = b.rooms[b.pos], info = ROOMS[room.type], c = b.carried;
            room.isKnown = true;
            if (role === 'SPECIALIST' && b.rooms[b.pos + 1]) b.rooms[b.pos + 1].isKnown = true;
            nameEl.textContent = info.name;
            statusEl.textContent = message || info.text;
            const bits = [c.salvage && `${c.salvage} salvage`, c.energy && `${c.energy} energy`, c.data && `${c.data} data`, c.items.length && `${c.items.length} item`, c.notes.length && `${c.notes.length} diary`].filter(Boolean);
            carriedEl.textContent = 'CARRYING: ' + (bits.join(' · ') || 'nothing yet');
            buttons.deeper.disabled = b.pos >= b.rooms.length - 1 || b.oxygen < MOVE_COST;
            buttons.search.disabled = room.isSearched || b.oxygen < SEARCH_COST;
            buttons.leave.innerHTML = `HEAD BACK <kbd>−${b.pos * MOVE_COST} O₂</kbd>`;
            buttons.leave.classList.toggle('is-urgent', b.oxygen <= b.pos * MOVE_COST + 1);
            if (b.oxygen < b.pos * MOVE_COST || (b.oxygen === 0 && b.pos > 0)) finish(false);
        }

        function act(kind) {
            if (isOver) return;
            if (kind === 'leave') { finish(true); return; }
            if (kind === 'deeper') { b.oxygen -= MOVE_COST; b.pos += 1; refresh(); return; }
            b.oxygen -= SEARCH_COST;
            b.rooms[b.pos].isSearched = true;
            const found = searchRoom(b), trouble = rollHazard(b);
            refresh(trouble ? `${found} ${trouble}` : found);
        }

        function finish(isSafe) {
            if (isOver) return;
            isOver = true;
            cancelAnimationFrame(raf);
            applyResult(app, station, b, isSafe);
            Object.values(buttons).forEach(btn => { btn.disabled = true; });
            statusEl.textContent = isSafe ? `${member.name} is back aboard.` : `Out of air. ${member.name} is dragged back through the airlock — hurt, and half the haul is gone.`;
            statusEl.classList.toggle('is-bad', !isSafe);
            setTimeout(() => close({ reachedCommand: isSafe && b.reachedCommand }), isSafe ? 1100 : 2600);
        }

        Object.keys(buttons).forEach(kind => buttons[kind].addEventListener('click', () => act(kind)));
        (function loop(now) { draw(ctx, b, now || 0); if (!isOver) raf = requestAnimationFrame(loop); })();
        refresh();
        buttons.deeper.focus();
    }

    function applyResult(app, station, b, isSafe) {
        const state = app.state, c = b.carried, share = isSafe ? 1 : 0.5;
        const salvage = Math.round(c.salvage * share), energy = Math.round(c.energy * share);
        state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
        state.energy = Math.min(100, state.energy + energy);
        if (isSafe) {
            c.items.forEach(item => state.cargo.push({ ...item, acquiredAt: station.name }));
            if (c.data && state.addColonyKnowledge) state.addColonyKnowledge(c.data, true);
            c.notes.forEach(note => state.addLog(`Diary from ${station.name}: ${note}`));
            if (b.role === 'LEADER') state.crew.forEach(m => { if (m.status !== 'DEAD' && m.stress > 0) m.stress -= 1; });
        } else {
            b.member.status = 'INJURED';
        }
        b.member.stress = Math.max(0, Math.min(3, (b.member.stress || 0) + b.shaken - (isSafe ? c.calm : 0)));
        state.addLog(isSafe
            ? `${b.member.name} returns from ${station.name}: +${salvage} salvage${energy ? `, +${energy} energy` : ''}${c.data ? `, +${c.data} data` : ''}${c.items.length ? `, ${c.items.length} item` : ''}.`
            : `WARNING: ${b.member.name} ran out of air aboard ${station.name}. INJURED. Only ${salvage} salvage recovered.`);
        state.emitUpdates();
        if (app.updateCrewStatusDisplay) app.updateCrewStatusDisplay();
        if (app.autoSave) app.autoSave();
    }

    window.BoardingParty = { start, ageOf };
})();
