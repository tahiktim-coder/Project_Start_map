class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.muted = true; // Default OFF
        this.masterGain.gain.value = 0; // Start silenced
        this.masterGain.connect(this.ctx.destination);
        this.initialized = false;
    }

    toggleMute() {
        this.muted = !this.muted;
        const newVol = this.muted ? 0 : 0.3;
        this.masterGain.gain.setValueAtTime(newVol, this.ctx.currentTime);
        return this.muted;
    }

    // ... (init remains same) ...

    sfxVictory() {
        // Colony Established: Major Chord (C - E - G)
        if (!this.initialized || this.muted) return;
        const now = this.ctx.currentTime;
        [261.63, 329.63, 392.00].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.value = freq;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.1, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 2.0);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 2.0);
        });
    }

    init() {
        // AudioContext requires user gesture to start.
        // We attach a one-time listener to the body.
        if (this.ctx.state === 'suspended') {
            const resumeAudio = () => {
                this.ctx.resume();
                this.initialized = true;
                this.playTone(440, 'sine', 0.1); // Startup ping
                document.body.removeEventListener('click', resumeAudio);
                document.body.removeEventListener('keydown', resumeAudio);
            };
            document.body.addEventListener('click', resumeAudio);
            document.body.addEventListener('keydown', resumeAudio);
        } else {
            this.initialized = true;
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // UI Interaction
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('button') || e.target.closest('.clickable'); // Handle child elements
            if (target) {
                // Pitch variation to prevent ear fatigue
                const drift = Math.random() * 50 - 25;

                if (target.classList.contains('danger')) {
                    // Low warning thud
                    this.playTone(150 + drift, 'sawtooth', 0.1, 0.05);
                } else if (target.classList.contains('nav-node')) {
                    // High data chirp
                    this.playTone(1200 + drift, 'sine', 0.03, 0.05);
                } else {
                    // Standard UI tick (Slightly randomized)
                    this.playTone(800 + drift, 'sine', 0.03, 0.05);
                }
            }
        });

        // Game Events
        window.addEventListener('req-action-scan', () => this.sfxScan());
        window.addEventListener('req-action-probe', () => this.sfxProbe());
        window.addEventListener('req-action-eva', () => this.sfxWarn());
        window.addEventListener('req-warp', () => this.sfxWarp());
        window.addEventListener('log-updated', (e) => {
            if (e.detail?.message?.includes("WARNING")) this.sfxError();
            else this.playTone(600, 'square', 0.05, 0.1);
        });
    }

    // --- SYNTH GEN ---

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // --- PRESETS ---

    sfxScan() {
        // Rising sweep
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 1.0);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);

        osc.start();
        osc.stop(this.ctx.currentTime + 1.0);
    }

    sfxProbe() {
        // "Krr-chk"
        this.playTone(150, 'sawtooth', 0.2, 0.2);
        setTimeout(() => this.playTone(600, 'sine', 0.1), 100);
    }

    sfxWarp() {
        // Low rumble
        this.playTone(50, 'sawtooth', 2.0, 0.3);
    }

    sfxWarn() {
        // Double beep
        this.playTone(400, 'square', 0.2);
        setTimeout(() => this.playTone(400, 'square', 0.2), 300);
    }

    sfxError() {
        // Buzz
        this.playTone(100, 'sawtooth', 0.5, 0.2);
    }
}

// Global Export
window.AudioSystem = new AudioSystem();
