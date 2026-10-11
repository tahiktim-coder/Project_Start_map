/* ═══ Silent Exodus · new screen (?new=1) · start/FilmSound.js: the sound kit of the films ════════════════════════════
   What it is: every sound of a film is made in code with the Web Audio API (noise, oscillators, filters; no files), and
   it follows the film's own clock, so a skip fires nothing. It plays only when the GAME's sound is on: built only when
   AudioSystem exists, is not muted and the page was not opened with ?mute=1; it then shares the game's AudioContext (one
   context for the whole page, as the minigames do), so with sound off no AudioContext is ever made here. Muting the game
   while a film plays silences it at once. There is no sound button: the game's own switch decides.
   Source: prototypes/films/film-sound.js (the kit, the soft clip, the master ceiling, the cue clock), ported without its
   button, its ?sound= read and its own AudioContext; every source it starts is stopped by close(); seeded, no Math.random.
   Loaded only when the new-screen switch is on.

   window.NSFilmSound (frozen)
     isGameSoundOn() → bool
     attach({ score(kit) → { cues: [[ms, fn(at, kit)], ...], update(T, dt, live) } }) → film sound:
       tick(T, live)   once per rendered frame, with the film's clock (ms) and whether it is playing forward
       close()         fades out over 0.4 s and stops every source (call when the film ends or is skipped)
       state()         { built, context, master, cues, rms, peak } for checking without ears
     MASTER (0.3)      the loudness ceiling after the soft clip
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const MASTER = 0.3;                 // the master volume ceiling (the soft clip keeps the mix at or under 1 before it)
    const LOOKAHEAD = 60;               // ms: cues this close ahead are scheduled now, on the audio clock
    const MAX_STEP = 300;               // ms: a bigger jump in the film's clock is a skip or a seek, and fires no cues
    const CLOSE_MS = 400;               // the fade on close, then every source is stopped

    /** The game's sound switch: off with ?mute=1, when the player muted the game, or when the game has no audio. */
    function isGameSoundOn() {
        const game = window.AudioSystem;
        let urlMuted = false;
        try { urlMuted = new URLSearchParams(location.search).get('mute') === '1'; } catch (err) { urlMuted = false; }
        return !!(game && game.ctx && !game.muted) && !urlMuted;
    }

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
    function clickBuffer(ac, ms, seed) {
        const n = Math.floor(ac.sampleRate * ms / 1000), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0), r = rng(seed);
        for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, 3);
        return buf;
    }

    /** The kit a score builds with. Every node it makes ends at `out` unless told otherwise; every source is kept for close(). */
    function makeKit(ac, out, sources) {
        const buffers = { white: noiseBuffer(ac, 'white', 3, 11), pink: noiseBuffer(ac, 'pink', 4, 12), brown: noiseBuffer(ac, 'brown', 5, 13), click: clickBuffer(ac, 6, 14) };
        const last = new Map(), r = rng(77);
        const keep = s => { sources.add(s); s.onended = () => sources.delete(s); return s; };
        return {
            ac, out, buffers, rng,
            now: () => ac.currentTime,
            gain(v = 0, to) { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; },
            filter(type, f, Q = 0.707, to) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; if (to) b.connect(to); return b; },
            pan(v, to) { const p = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); if (p.pan) p.pan.value = v; if (to) p.connect(to); return p; },
            osc(type, f, to) { const o = keep(ac.createOscillator()); o.type = type; o.frequency.value = f; if (to) o.connect(to); o.start(); return o; },
            /** A looping noise source, started at a seeded place in its buffer. */
            loop(kind, to, rate = 1) { const s = keep(ac.createBufferSource()); s.buffer = buffers[kind]; s.loop = true; s.playbackRate.value = rate; if (to) s.connect(to); s.start(0, r() * (s.buffer.duration - 0.1)); return s; },
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
                const s = keep(ac.createBufferSource()), fl = ac.createBiquadFilter(), g = ac.createGain();
                s.buffer = buf; s.playbackRate.value = o.rate || 1;
                fl.type = o.type || 'lowpass'; fl.Q.value = o.Q == null ? 0.707 : o.Q;
                fl.frequency.setValueAtTime(o.f, at); if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, at + dur);
                g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(o.gain, at + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
                s.connect(fl); fl.connect(g); g.connect(o.to || out);
                s.start(at, buf === buffers.click ? 0 : r() * Math.max(0, buf.duration - dur - 0.1)); s.stop(at + dur + 0.05);
                return g;
            },
            /** A tone with a pitch glide and an envelope: { at, f, f2, dur, type, gain, attack, to }. */
            tone(o) {
                const at = Math.max(ac.currentTime, o.at == null ? ac.currentTime : o.at), dur = o.dur, osc = keep(ac.createOscillator()), g = ac.createGain();
                osc.type = o.type || 'sine';
                osc.frequency.setValueAtTime(o.f, at); if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, at + dur);
                g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(o.gain, at + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
                osc.connect(g); g.connect(o.to || out);
                osc.start(at); osc.stop(at + dur + 0.05);
                return g;
            },
        };
    }

    const SILENT = Object.freeze({ tick() {}, close() {}, state: () => ({ built: false, context: 'none', master: 0, cues: 0, rms: 0, peak: 0 }) });

    function attach(opts) {
        if (!isGameSoundOn() || !opts || typeof opts.score !== 'function') return SILENT;
        const game = window.AudioSystem, ac = game.ctx, sources = new Set();
        let master = null, analyser = null, bus = null, kit = null, score = null, cues = [], prevT = null, closed = false;
        let peak = 0, sumSq = 0, samples = 0;
        try {
            // soft clip: the mix comes out as tanh(mix), the same as it went in while quiet, bending over as it nears 1, never past it.
            // (A shaper only reads inputs in -1..1, so the mix is halved going in and the curve is tanh(2x).)
            bus = ac.createGain();
            const clip = ac.createWaveShaper(), curve = new Float32Array(2049);
            bus.gain.value = 0.5;
            for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(2 * (i / 1024 - 1));
            clip.curve = curve; clip.oversample = '2x';
            master = ac.createGain(); master.gain.value = 0;
            analyser = ac.createAnalyser(); analyser.fftSize = 2048;
            bus.connect(clip); clip.connect(master); master.connect(ac.destination); master.connect(analyser);
            kit = makeKit(ac, bus, sources);
            score = opts.score(kit) || {};
            cues = (score.cues || []).slice().sort((a, b) => a[0] - b[0]);
            if (ac.state === 'suspended') ac.resume().catch(() => { /* resumes on the next click, as the game's own sound does */ });
            master.gain.setTargetAtTime(MASTER, ac.currentTime, 0.3);
        } catch (err) {
            console.error('NSFilmSound: could not build the film sound', err);
            close();
            return SILENT;
        }

        function measure() {
            if (!analyser) return;
            const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
            for (let i = 0; i < a.length; i += 4) { const v = a[i]; sumSq += v * v; samples++; if (Math.abs(v) > peak) peak = Math.abs(v); }
        }
        function tick(T, live) {
            if (closed || !score || ac.state !== 'running') { prevT = T; return; }
            const muted = !!game.muted;
            kit.set(master.gain, muted ? 0 : MASTER, muted ? 0.02 : 0.3);
            const dt = prevT == null ? 0 : T - prevT, flowing = !!live && !muted && dt >= 0 && dt <= MAX_STEP;
            if (flowing && dt > 0) {
                const now = ac.currentTime;
                for (const c of cues) {
                    if (c[0] <= prevT + LOOKAHEAD) continue;
                    if (c[0] > T + LOOKAHEAD) break;
                    try { c[1](now + Math.max(0, (c[0] - T) / 1000), kit); } catch (err) { console.error('NSFilmSound: the cue at ' + c[0] + ' failed', err); }
                }
            }
            try { if (score.update) score.update(T, flowing ? dt : 0, flowing); } catch (err) { console.error('NSFilmSound: update failed', err); }
            measure();
            prevT = T;
        }
        function close() {
            if (closed) return;
            closed = true;
            if (!master) return;
            try { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0, ac.currentTime, CLOSE_MS / 4000); } catch (err) { /* already gone */ }
            setTimeout(() => {
                sources.forEach(s => { try { s.stop(); } catch (err) { /* never started or already stopped */ } });
                sources.clear();
                try { master.disconnect(); bus.disconnect(); } catch (err) { /* already gone */ }
            }, CLOSE_MS);
        }
        return {
            tick, close,
            state: () => ({ built: true, context: ac.state, master: +master.gain.value.toFixed(3), cues: cues.length, rms: samples ? +Math.sqrt(sumSq / samples).toFixed(4) : 0, peak: +peak.toFixed(4), sources: sources.size }),
        };
    }

    window.NSFilmSound = Object.freeze({ attach, isGameSoundOn, MASTER });
})();
