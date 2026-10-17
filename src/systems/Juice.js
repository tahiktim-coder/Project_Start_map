/* Juice — the shake every flight shares: the jump's corridor (both games) and the new screen's travel view and tower.
   Shake = trauma squared, so a small kick is barely felt and a hit is. Offsets come from smooth noise, never a fresh random
   number each frame (that looks like a broken picture, not a ship). With prefers-reduced-motion the amplitudes halve.
   Every caller must still work when this file is missing: it only adds feel, never a rule.
     const s = Juice.shaker({ max: [10, 7], roll: 0.012, decay: 1.6, hz: 11 });
     s.add(0.4)       trauma = min(1, trauma + a)
     s.floor(0.2)     a sustained minimum for THIS frame only (a rumble while burning, at full throttle)
     s.tick(dt_s)     trauma falls by decay x dt, never below this frame's floor → { dx, dy, rot } (floats; callers round)
     s.level()        trauma now, 0..1
     Juice.reduced()  → true while the player asks for reduced motion (read live)
     Juice.noise(s, seed, hz) → -1..1, the smooth noise the shaker uses (for a rattle that matches it) */

(function () {
    'use strict';
    const TAU = Math.PI * 2, SEED = { x: 0, y: 3.1, rot: 5.3 }, REDUCED_SCALE = 0.5;
    const query = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const finite = v => (Number.isFinite(v) ? v : 0);

    function reduced() {
        try { return !!(query && query.matches); } catch (err) { return false; }
    }
    function noise(s, seed, hz) {
        return 0.6 * Math.sin(TAU * hz * s + seed) + 0.4 * Math.sin(TAU * hz * 2.31 * s + seed * 1.7);
    }
    function shaker(options) {
        const o = options || {}, max = Array.isArray(o.max) ? [finite(o.max[0]), finite(o.max[1])] : [0, 0];
        const roll = finite(o.roll), decay = o.decay > 0 ? o.decay : 1.5, hz = o.hz > 0 ? o.hz : 10;
        let trauma = 0, floorNow = 0, s = 0;
        return Object.freeze({
            add(a) { trauma = Math.min(1, trauma + Math.max(0, finite(a))); },
            floor(a) { floorNow = Math.max(floorNow, Math.min(1, Math.max(0, finite(a)))); },
            tick(dt) {
                const d = Math.max(0, finite(dt));
                s += d;
                trauma = Math.max(floorNow, trauma - decay * d);
                floorNow = 0;
                const k = trauma * trauma * (reduced() ? REDUCED_SCALE : 1);
                if (k <= 0) return { dx: 0, dy: 0, rot: 0 };
                return { dx: max[0] * k * noise(s, SEED.x, hz), dy: max[1] * k * noise(s, SEED.y, hz), rot: roll * k * noise(s, SEED.rot, hz) };
            },
            level() { return trauma; },
        });
    }

    window.Juice = Object.freeze({ reduced, shaker, noise });
})();
