/* ChoiceGuard — a choice never appears under the cursor, and never takes a click it did not see (docs/GAME_FLOW.md 2.0).
   A player clicking NEXT quickly must not pick a story choice unread. Two guards, used together:
     ChoiceGuard.hold(root)                  ignores clicks (and Enter/Space) inside root for 400 ms after it appears
     ChoiceGuard.keepClear(pad, items, avoid) pushes items down (padding on pad) until none sits on the avoid box
   ChoiceGuard.lastClickBox() is a small box around the last place the player pressed, for a guard with no NEXT to avoid. */

(function () {
    'use strict';
    const LOCK_MS = 400, CLICK_BOX_PX = 14, RECENT_CLICK_MS = 2000, GAP_PX = 10, MAX_NUDGES = 8;
    let lastPress = null;

    document.addEventListener('pointerdown', e => {
        lastPress = { x: e.clientX, y: e.clientY, at: performance.now() };
    }, true);

    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

    /** Where the player last pressed, as a small box, or null when that was more than two seconds ago. */
    function lastClickBox() {
        if (!lastPress || performance.now() - lastPress.at > RECENT_CLICK_MS) return null;
        return { left: lastPress.x - CLICK_BOX_PX, right: lastPress.x + CLICK_BOX_PX, top: lastPress.y - CLICK_BOX_PX, bottom: lastPress.y + CLICK_BOX_PX };
    }

    /** A rect with a margin around it, as a plain object (so it survives the element being hidden). */
    function boxOf(el, margin = 0) {
        if (!el || !el.getBoundingClientRect) return null;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return null;
        return { left: r.left - margin, right: r.right + margin, top: r.top - margin, bottom: r.bottom + margin };
    }

    /** Clicks inside root are swallowed for ms (capture phase, so the buttons' own handlers never see them). */
    function hold(root, ms = LOCK_MS) {
        if (!root) return;
        const until = performance.now() + ms;
        const swallow = e => {
            if (performance.now() >= until) return;
            e.stopPropagation();
            e.preventDefault();
        };
        root.classList.add('is-settling');
        root.addEventListener('click', swallow, true);
        setTimeout(() => {
            root.classList.remove('is-settling');
            root.removeEventListener('click', swallow, true);
        }, ms);
    }

    /**
     * Adds top padding to pad until no visible item overlaps an avoid box (one box or a list; nulls are skipped).
     * Layout may re-centre after each nudge, so it measures again each time.
     */
    function keepClear(pad, items, avoid) {
        const boxes = (Array.isArray(avoid) ? avoid : [avoid]).filter(Boolean);
        if (!pad || !boxes.length) return;
        const visible = [...items].filter(el => el && el.isConnected && el.getClientRects().length);
        for (let k = 0; k < MAX_NUDGES; k++) {
            const pushes = [];
            visible.forEach(el => {
                const r = el.getBoundingClientRect();
                boxes.forEach(box => { if (overlaps(r, box)) pushes.push(box.bottom + GAP_PX - r.top); });
            });
            if (!pushes.length) return;
            const push = Math.max(...pushes);
            const current = parseFloat(getComputedStyle(pad).paddingTop) || 0;
            pad.style.paddingTop = `${Math.ceil(current + push)}px`;
        }
    }

    // Every pop-up (cards, panels, the disc, the plot and team screens, the minigames) ignores clicks for its first 400 ms, so a fast
    // second click on whatever opened it can never press a button the player has not seen.
    const POPUPS = '.modal-overlay, .warp-plot, .end-screen, .mini-host';
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.matches(POPUPS)) hold(node);
    }))).observe(document.body, { childList: true });

    window.ChoiceGuard = { LOCK_MS, hold, keepClear, lastClickBox, boxOf, overlaps };
})();
