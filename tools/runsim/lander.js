/* tools/runsim/lander.js — A.U.R.A.'s landing, headless: LanderGame.js's own rules (the ground of each world, the physics
   step, the grading and her autopilot) cut out of the file and run without a page, the way the depth plan's D1 asks
   ("run LanderGame's autopilot step headless if it separates from drawing"). Its ground is seeded by the world's id, so
   the same world always lands the same way: the result is kept per world.
   auraLanding(planet, unmarked) → { grade: 'soft' | 'rough' | 'crash', offMark: bool } | null (the cut failed: the caller
   falls back to its assumption)
*/
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT } = require('./game');

const FRAME_S = 1 / 60, MAX_SECONDS = 90;                                 // a 60 Hz screen (at 30 Hz it lands the same: soft 99.9 %)
let rules = null, failed = false;
const kept = new Map();

/** LanderGame.js from its constants to the end of the autopilot, as one function returning what is needed. */
function loadRules() {
    if (rules || failed) return rules;
    try {
        const src = fs.readFileSync(path.join(ROOT, 'src/systems/LanderGame.js'), 'utf8');
        const a = src.indexOf('const W = 320'), b = src.indexOf('// ── the picture');
        if (a < 0 || b < 0 || b < a) throw new Error('LanderGame.js changed: the rule block was not found');
        const body = src.slice(a, b);
        const stub = { window: {}, document: { hidden: false }, performance: { now: () => 0 }, requestAnimationFrame: () => 0, setTimeout: () => 0 };
        // eslint-disable-next-line no-new-func
        rules = new Function('window', 'document', 'performance', 'requestAnimationFrame', 'setTimeout',
            `${body}\nreturn { buildGround, startState, step, autopilot, isOnMark, BASE_GRAVITY, GRAVITY_CURVE };`)(stub.window, stub.document, stub.performance, stub.requestAnimationFrame, stub.setTimeout);
    } catch (err) {
        failed = true;
        rules = null;
    }
    return rules;
}

function auraLanding(planet, unmarked) {
    const R = loadRules();
    if (!R || !planet) return null;
    const key = `${planet.id}|${unmarked || ''}`;
    if (kept.has(key)) return kept.get(key);
    const g = R.buildGround(planet);
    g.unmarked = unmarked || null;
    const s = R.startState(g);
    s.isAuto = true; s.isReleased = true;
    const gravityG = Math.max(0.4, Math.min(2.2, (planet.metrics && planet.metrics.gravity) || 1));
    const gravity = R.BASE_GRAVITY * Math.pow(gravityG, R.GRAVITY_CURVE);
    let landed = null;
    for (let t = 0; t < MAX_SECONDS && !landed; t += FRAME_S) {
        R.autopilot(s, g);
        landed = R.step(s, g, gravity, FRAME_S);
    }
    const grade = landed || 'crash';
    const offMark = grade !== 'crash' && !g.kind.platform && !R.isOnMark(g, Math.round(s.x));
    const out = { grade: offMark ? 'rough' : grade, offMark };                 // LanderGame's end(): off the mark is a rough landing
    kept.set(key, out);
    return out;
}

module.exports = { auraLanding };
