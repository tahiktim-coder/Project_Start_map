/*
  SILENT EXODUS · FILM SOUND (optional, OFF by default). Shared by launch.html and sea.html.
  Every sound is made in code with the Web Audio API: noise, oscillators and filters. No audio files, nothing downloaded.

  HOW IT TURNS ON
    A small "Sound off" button sits in the bottom-left corner. Click it to turn sound on, click again to turn it off.
    ?sound=1 starts with sound wanted; a browser still needs one click on the page before it lets sound play, so the button
    then says "click here to start". (Clicking the film itself skips it, so the button keeps its clicks to itself.)
    Nothing is built until sound is wanted: no AudioContext exists while the button says "Sound off".

  HOW A FILM USES IT
    const sound = FilmSound.attach({ score(kit) { ...build beds...; return { cues: [[ms, fn(at, kit)], ...], update(T, dt, live) {} } } });
    sound.tick(T, live)   once per rendered frame, with the film's own clock (ms) and whether it is playing.
    The score follows the FILM's clock, not the wall clock: pausing, skipping and "Watch again" stay in step.
    Cues fire only while the film plays forward normally; a skip or a jump fires nothing.

  LOUDNESS
    Everything goes through a soft clip (out = tanh(mix): never past 1) and a master gain of 0.3 (MASTER), so nothing leaves
    the page louder than 0.3. The master fades in over about a second when sound is turned on.
    window.filmSound.state() reports what is built and how loud the last stretch was (for checking without ears).
*/
(function () {
    'use strict';
    const MASTER = 0.3;                 // the master volume ceiling (the soft clip keeps the mix at or under 1 before it)
    const LOOKAHEAD = 60;               // ms: cues this close ahead are scheduled now, on the audio clock
    const MAX_STEP = 300;               // ms: a bigger jump in the film's clock is a skip or a seek, and fires no cues

    /** A small seeded random, so every play of a film sounds the same. */
    function rng(seed) {
        let a = seed >>> 0;
        return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }

    /** A looping noise buffer: white, pink or brown, cross-faded at the seam so the loop never clicks, scaled to an even loudness. */
    function noiseBuffer(ac, kind, seconds, seed) {
        const n = Math.floor(ac.sampleRate * seconds), N = Math.floor(ac.sampleRate * 0.05), g = new Float32Array(n + N), r = rng(seed);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
        for (let i = 0; i < n + N; i++) {
            const w = r() * 2 - 1;
            if (kind === 'pink') {
                b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
                b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
                g[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
            } else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; g[i] = last; }
            else g[i] = w;
        }
        const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = i < N ? g[n + i] * (1 - i / N) + g[i] * (i / N) : g[i];
        let ss = 0; for (let i = 0; i < n; i++) ss += d[i] * d[i];
        const k = 0.25 / Math.sqrt(ss / n || 1);
        for (let i = 0; i < n; i++) d[i] *= k;
        return buf;
    }
    /** A click: a few milliseconds of decaying noise (the grain for applause, crackle and creaks). */
    function clickBuffer(ac, ms, seed) {
        const n = Math.floor(ac.sampleRate * ms / 1000), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0), r = rng(seed);
        for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, 3);
        return buf;
    }

    /** The kit a score builds with. Every node it makes ends at `out` unless told otherwise. */
    function makeKit(ac, out) {
        const buffers = { white: noiseBuffer(ac, 'white', 3, 11), pink: noiseBuffer(ac, 'pink', 4, 12), brown: noiseBuffer(ac, 'brown', 5, 13), click: clickBuffer(ac, 6, 14) };
        const last = new Map();
        const kit = {
            ac, out, buffers, rng,
            now: () => ac.currentTime,
            gain(v = 0, to) { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; },
            filter(type, f, Q = 0.707, to) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; if (to) b.connect(to); return b; },
            pan(v, to) { const p = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); if (p.pan) p.pan.value = v; if (to) p.connect(to); return p; },
            osc(type, f, to) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; if (to) o.connect(to); o.start(); return o; },
            /** A looping noise source, started at a random place in its buffer. */
            loop(kind, to, rate = 1) { const s = ac.createBufferSource(); s.buffer = buffers[kind]; s.loop = true; s.playbackRate.value = rate; if (to) s.connect(to); s.start(0, Math.random() * (s.buffer.duration - 0.1)); return s; },
            chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; },
            /** Glide a parameter toward v (time constant tc seconds). Repeating the same value costs nothing. */
            set(param, v, tc = 0.05) {
                const was = last.get(param);
                if (was !== undefined && Math.abs(was - v) <= 1e-4 * Math.max(1, Math.abs(v))) return;
                last.set(param, v);
                param.setTargetAtTime(v, ac.currentTime, tc);
            },
            /** A burst of filtered noise with an envelope: { at, dur, kind, type, f, f2, Q, gain, attack, rate, to }. */
            burst(o) {
                const at = Math.max(ac.currentTime, o.at == null ? ac.currentTime : o.at), dur = o.dur, buf = buffers[o.kind || 'white'];
                const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
                s.buffer = buf; s.playbackRate.value = o.rate || 1;
                fl.type = o.type || 'lowpass'; fl.Q.value = o.Q == null ? 0.707 : o.Q;
                fl.frequency.setValueAtTime(o.f, at); if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, at + dur);
                g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(o.gain, at + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
                s.connect(fl); fl.connect(g); g.connect(o.to || out);
                s.start(at, buf === buffers.click ? 0 : Math.random() * Math.max(0, buf.duration - dur - 0.1)); s.stop(at + dur + 0.05);
                return g;
            },
            /** A tone with a pitch glide and an envelope: { at, f, f2, dur, type, gain, attack, to }. */
            tone(o) {
                const at = Math.max(ac.currentTime, o.at == null ? ac.currentTime : o.at), dur = o.dur, osc = ac.createOscillator(), g = ac.createGain();
                osc.type = o.type || 'sine';
                osc.frequency.setValueAtTime(o.f, at); if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, at + dur);
                g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(o.gain, at + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
                osc.connect(g); g.connect(o.to || out);
                osc.start(at); osc.stop(at + dur + 0.05);
                return g;
            },
            /** Grains at `rate` per second, spread over the next `dt` ms; acc carries the fraction between frames. */
            grains(acc, rate, dt, make) {
                acc.n = (acc.n || 0) + rate * dt / 1000;
                const now = ac.currentTime;
                while (acc.n >= 1) { acc.n -= 1; make(now + Math.random() * dt / 1000); }
                return acc;
            },
        };
        return kit;
    }

    const CSS = `
#film-sound { position: fixed; left: 12px; bottom: 12px; z-index: 10; display: flex; align-items: center; gap: 9px; margin: 0;
    background: rgba(5, 7, 10, 0.78); border: 1px dashed #2c3036; color: #8b8d90; cursor: pointer; opacity: 0.72;
    font: 500 11px/1 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; letter-spacing: 0.18em; text-transform: uppercase; padding: 7px 11px 7px 9px;
    transition: opacity 160ms ease, color 160ms ease, border-color 160ms ease; }
#film-sound:hover, #film-sound:focus-visible { opacity: 1; color: #e4e4e0; border-color: #5a6168; outline: none; }
#film-sound:active { transform: translateY(1px); }
#film-sound .bars { display: flex; align-items: flex-end; gap: 2px; height: 10px; }
#film-sound .bars i { display: block; width: 2px; background: currentColor; opacity: 0.35; }
#film-sound .bars i:nth-child(1) { height: 4px; } #film-sound .bars i:nth-child(2) { height: 7px; } #film-sound .bars i:nth-child(3) { height: 10px; }
#film-sound[data-state="on"] { color: #c9d1d6; border-style: solid; border-color: #3a4048; }
#film-sound[data-state="on"] .bars i { opacity: 1; background: #f08c2e; }
#film-sound[data-state="waiting"] { color: #e4e4e0; opacity: 1; border-color: #f08c2e; }
#film-sound[data-state="waiting"] .bars i { background: #f08c2e; animation: film-sound-wait 1.1s steps(2) infinite; }
#film-sound .hint { color: #5a6168; letter-spacing: 0.12em; }
#film-sound[data-state="waiting"] .hint { color: #f08c2e; }
@keyframes film-sound-wait { 50% { opacity: 0.2; } }
@media (prefers-reduced-motion: reduce) { #film-sound[data-state="waiting"] .bars i { animation: none; } }
`;

    function attach(opts) {
        const q = new URLSearchParams(location.search);
        let ac = null, master = null, analyser = null, kit = null, score = null, cues = [], wanted = false, prevT = null, failed = false;
        let peak = 0, sumSq = 0, samples = 0;

        const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
        const btn = document.createElement('button');
        btn.type = 'button'; btn.id = 'film-sound';
        btn.innerHTML = '<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="label"></span><span class="hint"></span>';
        btn.title = 'Sound made in the page, no files. Off by default. A browser needs one click before it will play any sound. Add ?sound=1 to the address to start with it on.';
        document.body.appendChild(btn);
        const label = btn.querySelector('.label'), hint = btn.querySelector('.hint');

        function refresh() {
            const running = !!ac && ac.state === 'running';
            const st = failed ? 'off' : !wanted ? 'off' : running ? 'on' : 'waiting';
            btn.dataset.state = st;
            btn.setAttribute('aria-pressed', String(wanted && !failed));
            if (failed) { label.textContent = 'No sound here'; hint.textContent = 'this browser has no Web Audio'; return; }
            label.textContent = st === 'off' ? 'Sound off' : 'Sound on';
            hint.textContent = st === 'off' ? '· click to turn on' : st === 'on' ? '· click to turn off' : '· click here to start (the browser needs one click)';
        }
        function build() {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { failed = true; return false; }
            try {
                ac = new AC();
                // soft clip: the mix comes out as tanh(mix), the same as it went in while quiet, bending over as it nears 1, never past it.
                // (A shaper only reads inputs in -1..1, so the mix is halved going in and the curve is tanh(2x).)
                const bus = ac.createGain(), clip = ac.createWaveShaper(), curve = new Float32Array(2049);
                bus.gain.value = 0.5;
                for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(2 * (i / 1024 - 1));
                clip.curve = curve; clip.oversample = '2x';
                master = ac.createGain(); master.gain.value = 0;
                analyser = ac.createAnalyser(); analyser.fftSize = 2048;
                bus.connect(clip); clip.connect(master); master.connect(ac.destination); master.connect(analyser);
                kit = makeKit(ac, bus);
                score = opts.score(kit) || {};
                cues = (score.cues || []).slice().sort((a, b) => a[0] - b[0]);
                ac.onstatechange = refresh;
                return true;
            } catch (err) {
                console.error('film sound: could not build', err);
                failed = true; ac = null;
                return false;
            }
        }
        function enable() {
            wanted = true;
            if (!ac && !build()) { refresh(); return; }
            ac.resume().then(refresh, refresh);
            master.gain.cancelScheduledValues(ac.currentTime);
            master.gain.setTargetAtTime(MASTER, ac.currentTime, 0.3);
            refresh();
        }
        function disable() {
            wanted = false;
            if (ac) {
                master.gain.cancelScheduledValues(ac.currentTime);
                master.gain.setTargetAtTime(0, ac.currentTime, 0.06);
                setTimeout(() => { if (!wanted && ac && ac.state === 'running') ac.suspend().then(refresh, refresh); }, 450);
            }
            refresh();
        }
        // The button keeps its own clicks and keys: the film skips on any click or Enter/Space anywhere else.
        btn.addEventListener('pointerdown', e => e.stopPropagation());
        btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (!wanted) enable();
            else if (ac && ac.state !== 'running') enable();      // wanted but the browser was waiting for this click
            else disable();
        });
        // Any other click or key on the page also counts as the browser's one click, when sound is wanted and waiting.
        const wake = () => { if (wanted && ac && ac.state !== 'running') ac.resume().then(refresh, refresh); };
        addEventListener('pointerdown', wake, true);
        addEventListener('keydown', wake, true);

        function measure() {
            if (!analyser) return;
            const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
            for (let i = 0; i < a.length; i += 4) { const v = a[i]; sumSq += v * v; samples++; if (Math.abs(v) > peak) peak = Math.abs(v); }
        }
        function tick(T, live) {
            if (!ac || !score || ac.state !== 'running') { prevT = T; return; }
            const dt = prevT == null ? 0 : T - prevT, flowing = !!live && wanted && dt >= 0 && dt <= MAX_STEP;
            if (flowing && dt > 0) {
                const now = ac.currentTime;
                for (const c of cues) {
                    if (c[0] <= prevT + LOOKAHEAD) continue;
                    if (c[0] > T + LOOKAHEAD) break;
                    try { c[1](now + Math.max(0, (c[0] - T) / 1000), kit); } catch (err) { console.error('film sound: cue at ' + c[0] + ' failed', err); }
                }
            }
            try { if (score.update) score.update(T, flowing ? dt : 0, flowing); } catch (err) { console.error('film sound: update failed', err); }
            measure();
            prevT = T;
        }

        const api = {
            tick, enable, disable,
            state: () => ({ wanted, built: !!ac, context: ac ? ac.state : 'none', master: master ? +master.gain.value.toFixed(3) : 0, cues: cues.length,
                rms: samples ? +Math.sqrt(sumSq / samples).toFixed(4) : 0, peak: +peak.toFixed(4), label: btn.textContent.trim() }),
            resetMeter() { peak = 0; sumSq = 0; samples = 0; },
        };
        window.filmSound = api;
        refresh();
        if (q.get('sound') === '1') enable();       // wanted from the start; the browser may still wait for one click
        return api;
    }

    window.FilmSound = Object.freeze({ attach, MASTER });
})();
