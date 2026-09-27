// Hexland - Web Audio 8-Bit Retro Sound Generator

class SoundFX {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    playTone(freq, type = 'square', duration = 0.1, gainValue = 0.15) {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio error ignored safely
        }
    }

    playDiceRoll() {
        if (this.isMuted) return;
        this.init();
        for (let i = 0; i < 7; i++) {
            setTimeout(() => {
                const freq = 200 + Math.random() * 400;
                this.playTone(freq, 'square', 0.04, 0.1);
            }, i * 45);
        }
    }

    playHarvest() {
        if (this.isMuted) return;
        this.init();
        // Retro Coin / Collect chime
        this.playTone(987.77, 'sine', 0.08, 0.12); // B5
        setTimeout(() => this.playTone(1318.51, 'sine', 0.18, 0.15), 80); // E6
    }

    playBuild() {
        if (this.isMuted) return;
        this.init();
        // Cheerful build chord
        this.playTone(440, 'triangle', 0.06, 0.15); // A4
        setTimeout(() => this.playTone(554.37, 'triangle', 0.06, 0.15), 60); // C#5
        setTimeout(() => this.playTone(659.25, 'triangle', 0.12, 0.18), 120); // E5
    }

    playRobber() {
        if (this.isMuted) return;
        this.init();
        // Low menacing buzz
        this.playTone(150, 'sawtooth', 0.15, 0.2);
        setTimeout(() => this.playTone(110, 'sawtooth', 0.25, 0.22), 120);
    }

    playCard() {
        if (this.isMuted) return;
        this.init();
        this.playTone(600, 'sine', 0.05, 0.08);
        setTimeout(() => this.playTone(850, 'sine', 0.08, 0.1), 50);
    }

    playVictory() {
        if (this.isMuted) return;
        this.init();
        // Retro 8-bit victory fanfare
        const notes = [
            { f: 523.25, d: 0.12 }, // C5
            { f: 523.25, d: 0.12 },
            { f: 523.25, d: 0.12 },
            { f: 659.25, d: 0.35 }, // E5
            { f: 587.33, d: 0.15 }, // D5
            { f: 659.25, d: 0.15 }, // E5
            { f: 783.99, d: 0.5 }   // G5
        ];

        let delay = 0;
        notes.forEach(note => {
            setTimeout(() => {
                this.playTone(note.f, 'triangle', note.d, 0.25);
            }, delay * 1000);
            delay += note.d + 0.04;
        });
    }
}

const soundFX = new SoundFX();
