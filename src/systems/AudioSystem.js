class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        // `?mute=1` starts the game silent (and remembers it) — for testing in a background tab. `?mute=0` clears it.
        const muteParam = new URLSearchParams(location.search).get('mute');
        try {
            if (muteParam === '1') localStorage.setItem('psm-muted', '1');
            if (muteParam === '0') localStorage.removeItem('psm-muted');
            this.muted = localStorage.getItem('psm-muted') === '1';
        } catch (e) {
            this.muted = muteParam === '1'; // storage blocked: the URL still works for this load
        }
        this.masterGain.gain.value = this.muted ? 0 : 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = false;

        // Background music
        this.bgMusic = null;
        this.bgMusicGain = null;
        this.musicVolume = 0.15; // Lower than SFX
    }

    /**
     * Mute all audio
     */
    mute() {
        this.muted = true;
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        if (this.bgMusic) {
            this.bgMusic.volume = 0;
        }
    }

    /**
     * Unmute all audio
     */
    unmute() {
        this.muted = false;
        this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        if (this.bgMusic) {
            this.bgMusic.volume = this.musicVolume;
            if (this.bgMusic.paused) {
                this.bgMusic.play().catch(() => {});
            }
        }
        // Start music if not already playing
        if (!this.bgMusic) {
            this.startBackgroundMusic();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        const newVol = this.muted ? 0 : 0.3;
        this.masterGain.gain.setValueAtTime(newVol, this.ctx.currentTime);

        // Also toggle music (HTML Audio element)
        if (this.bgMusic && this.bgMusic.volume !== undefined) {
            this.bgMusic.volume = this.muted ? 0 : this.musicVolume;
            // Resume playback if unmuting and music is paused
            if (!this.muted && this.bgMusic.paused) {
                this.bgMusic.play().catch(() => {});
            }
        }

        // Start music on first unmute
        if (!this.muted && !this.bgMusic) {
            this.startBackgroundMusic();
        }

        return this.muted;
    }

    /**
     * Load and play background music on loop
     * Uses HTML Audio element for file:// protocol compatibility
     */
    startBackgroundMusic() {
        if (this.bgMusic) return; // Already playing

        try {
            // Use HTML Audio element - works with file:// protocol
            this.bgMusic = new Audio('Music/Space_Project_Background.mp3');
            this.bgMusic.loop = true;
            this.bgMusic.volume = this.muted ? 0 : this.musicVolume;

            // Handle autoplay restrictions
            const playPromise = this.bgMusic.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('Background music started');
                }).catch(e => {
                    console.warn('Music autoplay blocked, will retry on interaction:', e);
                    // Retry on next user interaction
                    const retryPlay = () => {
                        this.bgMusic.play().catch(() => {});
                        document.body.removeEventListener('click', retryPlay);
                    };
                    document.body.addEventListener('click', retryPlay);
                });
            }
        } catch (e) {
            console.warn('Could not load background music:', e);
        }
    }

    /**
     * Set music volume (0-1)
     */
    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.bgMusic && !this.muted) {
            this.bgMusic.volume = this.musicVolume;
        }
    }

    /**
     * Reset to normal background music (for new game after Heaven music)
     */
    resetToBackgroundMusic() {
        try {
            // Fade out current music (likely Heaven)
            if (this.bgMusic) {
                const oldMusic = this.bgMusic;
                const fadeInterval = setInterval(() => {
                    if (oldMusic.volume > 0.01) {
                        oldMusic.volume = Math.max(0, oldMusic.volume - 0.02);
                    } else {
                        oldMusic.pause();
                        clearInterval(fadeInterval);
                    }
                }, 30);
            }

            // Create and start normal background music
            const normalMusic = new Audio('Music/Space_Project_Background.mp3');
            normalMusic.loop = true;
            normalMusic.volume = 0;

            this.bgMusic = normalMusic;
            const playPromise = normalMusic.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Fade in
                    const fadeInInterval = setInterval(() => {
                        if (normalMusic.volume < (this.muted ? 0 : this.musicVolume)) {
                            normalMusic.volume = Math.min(this.musicVolume, normalMusic.volume + 0.02);
                        } else {
                            clearInterval(fadeInInterval);
                        }
                    }, 30);
                    console.log('Background music reset');
                }).catch(e => {
                    console.warn('Music reset autoplay blocked:', e);
                });
            }
        } catch (e) {
            console.warn('Could not reset background music:', e);
        }
    }

    /**
     * Switch to Heaven music (THE STRUCTURE theme)
     * Crossfades from current music to the ethereal Heaven track
     */
    playHeavenMusic() {
        try {
            // Create new audio element for Heaven track
            const heavenMusic = new Audio('Music/Heaven.mp3');
            heavenMusic.loop = true;
            heavenMusic.volume = 0; // Start silent for crossfade

            // Crossfade: fade out current music, fade in Heaven
            if (this.bgMusic) {
                const oldMusic = this.bgMusic;
                const fadeInterval = setInterval(() => {
                    if (oldMusic.volume > 0.01) {
                        oldMusic.volume = Math.max(0, oldMusic.volume - 0.01);
                    } else {
                        oldMusic.pause();
                        clearInterval(fadeInterval);
                    }
                }, 50); // 50ms intervals = ~0.75s fade
            }

            // Start Heaven music
            this.bgMusic = heavenMusic;
            const playPromise = heavenMusic.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Fade in
                    const fadeInInterval = setInterval(() => {
                        if (heavenMusic.volume < (this.muted ? 0 : this.musicVolume)) {
                            heavenMusic.volume = Math.min(this.musicVolume, heavenMusic.volume + 0.01);
                        } else {
                            clearInterval(fadeInInterval);
                        }
                    }, 50);
                    console.log('Heaven music started');
                }).catch(e => {
                    console.warn('Heaven music autoplay blocked:', e);
                });
            }
        } catch (e) {
            console.warn('Could not load Heaven music:', e);
        }
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
                // Start background music on first interaction (audio is ON by default)
                if (!this.muted && !this.bgMusic) {
                    this.startBackgroundMusic();
                }
                document.body.removeEventListener('click', resumeAudio);
                document.body.removeEventListener('keydown', resumeAudio);
            };
            document.body.addEventListener('click', resumeAudio);
            document.body.addEventListener('keydown', resumeAudio);
        } else {
            this.initialized = true;
            // Start background music immediately if not muted
            if (!this.muted && !this.bgMusic) {
                this.startBackgroundMusic();
            }
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
            else if (e.detail?.message?.includes("CRITICAL")) this.sfxCritical();
            else if (e.detail?.message?.includes("A.U.R.A.")) this.sfxAura();
            else this.playTone(600, 'square', 0.05, 0.1);
        });

        // Additional game events
        window.addEventListener('req-action-anomaly', () => this.sfxAnomaly());
        window.addEventListener('sector-entered', () => this.sfxSectorEnter());
        window.addEventListener('colony-established', () => this.sfxVictory());
        window.addEventListener('hud-updated', () => this.sfxTick());
        window.addEventListener('aura-vent-warning', () => this.sfxAlarm());
        window.addEventListener('req-action-colony-site', () => this.sfxDiscovery());
        window.addEventListener('req-action-exodus', () => this.sfxDiscovery());
        window.addEventListener('game-over', (e) => {
            if (e.detail?.type === 'COLONY_SUCCESS') this.sfxVictory();
            else this.sfxDefeat();
        });

        // Crew events
        window.addEventListener('crew-death', () => this.sfxCrewDeath());
        window.addEventListener('crew-injury', () => this.sfxCrewInjury());
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

    sfxInteract() {
        // UI click/interact sound
        this.playTone(600, 'sine', 0.05, 0.1);
    }

    sfxTeleport() {
        // Weird warping sound for anomaly teleport
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2000, this.ctx.currentTime + 0.3);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.8);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);

        osc.start();
        osc.stop(this.ctx.currentTime + 1.0);
    }

    sfxHorror() {
        // Creepy low drone for cosmic horror moments
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc2.type = 'sine';
        osc.frequency.value = 40;
        osc2.frequency.value = 42; // Slight detune for unsettling beat

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3.0);

        osc.start();
        osc2.start();
        osc.stop(this.ctx.currentTime + 3.0);
        osc2.stop(this.ctx.currentTime + 3.0);
    }

    sfxAnomaly() {
        // Eerie pulsing tone for anomaly encounters
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        // Create wobbling effect
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const mainGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 300;
        lfo.type = 'sine';
        lfo.frequency.value = 4; // 4Hz wobble

        lfoGain.gain.value = 50; // Wobble amount
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(mainGain);
        mainGain.connect(this.masterGain);

        mainGain.gain.setValueAtTime(0.15, now);
        mainGain.gain.linearRampToValueAtTime(0, now + 1.5);

        osc.start(now);
        lfo.start(now);
        osc.stop(now + 1.5);
        lfo.stop(now + 1.5);
    }

    sfxSectorEnter() {
        // Deep "arrival" sound - descending majesty
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        // Bass note
        this.playTone(80, 'sine', 1.0, 0.15);
        // Mid sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.8);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 1.0);
    }

    sfxTick() {
        // Very subtle UI tick (quieter than standard)
        if (!this.initialized) return;
        this.playTone(1000, 'sine', 0.02, 0.02);
    }

    sfxAlarm() {
        // Urgent alarm sound
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        // Two-tone alarm pattern
        for (let i = 0; i < 4; i++) {
            const t = now + i * 0.3;
            this.playToneAt(800, 'square', 0.1, 0.15, t);
            this.playToneAt(600, 'square', 0.1, 0.15, t + 0.15);
        }
    }

    sfxDiscovery() {
        // Positive discovery chime
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        // Ascending notes (C-E-G)
        this.playToneAt(523.25, 'sine', 0.15, 0.1, now);
        this.playToneAt(659.25, 'sine', 0.15, 0.1, now + 0.1);
        this.playToneAt(783.99, 'sine', 0.3, 0.12, now + 0.2);
    }

    sfxCritical() {
        // Critical warning - deeper, more urgent
        if (!this.initialized) return;
        this.playTone(80, 'sawtooth', 0.4, 0.25);
        setTimeout(() => this.playTone(80, 'sawtooth', 0.4, 0.25), 200);
    }

    sfxAura() {
        // A.U.R.A. speaking - subtle digital chirp
        if (!this.initialized) return;
        this.playTone(1200, 'sine', 0.05, 0.05);
        setTimeout(() => this.playTone(1400, 'sine', 0.03, 0.04), 50);
    }

    sfxCrewDeath() {
        // Somber low tone for crew death
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        // Descending minor chord
        this.playToneAt(220, 'sine', 1.5, 0.1, now);
        this.playToneAt(261.63, 'sine', 1.5, 0.08, now + 0.1);
        this.playToneAt(311.13, 'sine', 1.5, 0.06, now + 0.2); // Minor third
    }

    sfxCrewInjury() {
        // Alert sound for injury
        if (!this.initialized) return;
        this.playTone(300, 'triangle', 0.3, 0.15);
        setTimeout(() => this.playTone(250, 'triangle', 0.2, 0.1), 150);
    }

    sfxDefeat() {
        // Game over defeat - descending doom
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 3.0);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 3.0);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 3.0);
    }

    // Helper: play tone at specific time
    playToneAt(freq, type, duration, vol, time) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration);
    }
}

// Global Export
window.AudioSystem = new AudioSystem();
