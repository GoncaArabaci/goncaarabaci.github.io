// Rail Rivals - small synthesized sound effects (Web Audio, no files)

class RailSound {
    constructor() {
        this.ctx = null;
        this.muted = false;
        try { this.muted = localStorage.getItem('railrivals-muted') === '1'; } catch (e) { /* storage blocked */ }
    }

    // Browsers only allow audio after a user gesture
    ensure() {
        if (this.muted) return null;
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    toggleMute() {
        this.muted = !this.muted;
        try { localStorage.setItem('railrivals-muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
        return this.muted;
    }

    tone(freq, start, dur, { type = 'sine', gain = 0.15, slide = 0 } = {}) {
        const ctx = this.ensure();
        if (!ctx) return;
        const t = ctx.currentTime + start;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    noise(start, dur, { gain = 0.12, freq = 2000, q = 1 } = {}) {
        const ctx = this.ensure();
        if (!ctx) return;
        const t = ctx.currentTime + start;
        const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter).connect(g).connect(ctx.destination);
        src.start(t);
    }

    card() { this.noise(0, 0.12, { gain: 0.18, freq: 3200, q: 0.8 }); this.tone(880, 0.02, 0.08, { gain: 0.05 }); }

    click() { this.tone(660, 0, 0.06, { type: 'triangle', gain: 0.08 }); }

    // chugging train: one puff per car placed
    claim(cars) {
        for (let i = 0; i < cars; i++) {
            this.noise(i * 0.11, 0.09, { gain: 0.22, freq: 380, q: 1.4 });
            this.tone(110, i * 0.11, 0.08, { type: 'square', gain: 0.04, slide: -40 });
        }
        this.tone(523, cars * 0.11 + 0.02, 0.18, { type: 'triangle', gain: 0.12 });
        this.tone(784, cars * 0.11 + 0.1, 0.25, { type: 'triangle', gain: 0.12 });
    }

    ticket() { [659, 880, 1175].forEach((f, i) => this.tone(f, i * 0.08, 0.3, { type: 'triangle', gain: 0.1 })); }

    yourTurn() { this.tone(587, 0, 0.14, { gain: 0.12 }); this.tone(880, 0.12, 0.22, { gain: 0.12 }); }

    whistle() {
        this.tone(740, 0, 0.7, { type: 'sawtooth', gain: 0.05 });
        this.tone(932, 0, 0.7, { type: 'sine', gain: 0.08 });
        this.tone(740, 0.8, 0.9, { type: 'sawtooth', gain: 0.05, slide: -60 });
        this.tone(932, 0.8, 0.9, { type: 'sine', gain: 0.08, slide: -60 });
    }

    error() { this.tone(220, 0, 0.12, { type: 'square', gain: 0.05 }); this.tone(180, 0.1, 0.16, { type: 'square', gain: 0.05 }); }

    fanfare() {
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i * 0.13, i === 5 ? 0.7 : 0.16, { type: 'triangle', gain: 0.13 }));
    }
}

const sound = new RailSound();
