/* tools/runsim/docking.js — A.U.R.A.'s docking, headless: DockingGame.js's own rules (the station's spin, the physics step,
   the contact grade and her autopilot, "LET A.U.R.A. DOCK") cut out of the file and run without a page, as lander.js does
   for the landing. The station's spin and port are seeded by its id (DockingGame's seeded()), so the same station always
   docks the same way: the result is kept per station.
   auraDocking(station) → 'soft' | 'rough' | 'crash' | null (the cut failed: the caller falls back to its assumption)
*/
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT } = require('./game');

const MAX_SECONDS = 180;
let rules = null, failed = false;
const kept = new Map();

/** DockingGame.js from its constants to the end of the autopilot, as one function returning what is needed. */
function loadRules() {
    if (rules || failed) return rules;
    try {
        const src = fs.readFileSync(path.join(ROOT, 'src/systems/DockingGame.js'), 'utf8');
        const a = src.indexOf('const W = 320'), b = src.indexOf('// ── drawing');
        if (a < 0 || b < 0 || b < a) throw new Error('DockingGame.js changed: the rule block was not found');
        const stub = { window: {}, performance: { now: () => 0 }, setTimeout: () => 0 };
        // eslint-disable-next-line no-new-func
        rules = new Function('window', 'performance', 'setTimeout',
            `${src.slice(a, b)}\nreturn { seeded, newState, step, autopilot, FRAME_MS, MAX_STEP };`)(stub.window, stub.performance, stub.setTimeout);
    } catch (err) {
        failed = true;
        rules = null;
    }
    return rules;
}

function auraDocking(station) {
    const R = loadRules();
    if (!R || !station) return null;
    const key = String(station.id);
    if (kept.has(key)) return kept.get(key);
    const s = R.newState(R.seeded(station.id));
    s.isAuto = true; s.isReleased = true;
    const dt = Math.min(R.MAX_STEP, R.FRAME_MS / 1000);                         // the game's frame: physics every 16 ms
    let grade = null;
    for (let t = 0; t < MAX_SECONDS && !grade; t += dt) {
        R.autopilot(s);
        grade = R.step(s, dt);
    }
    const out = grade || 'crash';
    kept.set(key, out);
    return out;
}

module.exports = { auraDocking };
