/* FrameClock — requestAnimationFrame that still ticks when the tab is hidden.
   Browsers stop rAF in a hidden tab, so a minigame driven only by rAF never paints and never advances there: its marker
   stays at zero and every result comes out as the worst grade, silently. request() falls back to a timer while hidden.
     const id = FrameClock.request(cb);   FrameClock.cancel(id); */

(function () {
    'use strict';
    const HIDDEN_FRAME_MS = 16;
    const timers = new Set();   // ids that came from setTimeout, so cancel() knows which API to call

    function request(callback) {
        if (!document.hidden) return requestAnimationFrame(callback);
        const id = setTimeout(() => { timers.delete(id); callback(performance.now()); }, HIDDEN_FRAME_MS);
        timers.add(id);
        return id;
    }

    function cancel(id) {
        if (timers.has(id)) { timers.delete(id); clearTimeout(id); } else cancelAnimationFrame(id);
    }

    window.FrameClock = { request, cancel };
})();
