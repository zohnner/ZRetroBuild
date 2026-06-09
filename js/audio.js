// === AUDIO MANAGER (Web Audio API) ===
class AudioManager {
    constructor() {
        this.ctx   = null;
        this.muted = false;
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {}
    }

    get _ok() { return !!this.ctx && !this.muted; }

    toggle() {
        this.muted = !this.muted;
        return this.muted;
    }

    _tone(freq, dur, type, vol, delay) {
        type  = type  || 'square';
        vol   = vol   || 0.28;
        delay = delay || 0;
        if (!this._ok) return;
        try {
            var osc  = this.ctx.createOscillator();
            var gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type            = type;
            osc.frequency.value = freq;
            var t = this.ctx.currentTime + delay;
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.00001, t + dur);
            osc.start(t);
            osc.stop(t + dur + 0.01);
        } catch (e) {}
    }

    coin() {
        this._tone(1046, 0.04, 'sine', 0.40);
        this._tone(784,  0.10, 'sine', 0.32, 0.04);
        this._tone(1046, 0.12, 'sine', 0.22, 0.10);
    }

    start() {
        var n = [262, 330, 392, 523, 659, 784, 1046];
        for (var i = 0; i < n.length; i++) this._tone(n[i], 0.12, 'square', 0.22, i * 0.065);
    }

    eat() {
        this._tone(880,  0.04, 'sine', 0.18);
        this._tone(1174, 0.07, 'sine', 0.14, 0.04);
    }

    die() {
        var n = [440, 370, 294, 220, 174, 131];
        for (var i = 0; i < n.length; i++) this._tone(n[i], 0.12, 'sawtooth', 0.24, i * 0.09);
    }

    highScore() {
        var n = [523, 659, 784, 1046, 784, 1046, 1318, 1568];
        for (var i = 0; i < n.length; i++) this._tone(n[i], 0.14, 'square', 0.18, i * 0.09);
    }

    error() {
        this._tone(220, 0.15, 'sawtooth', 0.28);
        this._tone(174, 0.22, 'sawtooth', 0.22, 0.12);
    }

    select() { this._tone(660, 0.06, 'square', 0.14); }

    konami() {
        var seq = [659, 659, 0, 659, 0, 523, 659, 784];
        for (var i = 0; i < seq.length; i++) {
            if (seq[i]) this._tone(seq[i], 0.10, 'square', 0.18, i * 0.12);
        }
        this._tone(1568, 0.35, 'square', 0.15, seq.length * 0.12);
    }
}

window.audio = new AudioManager();
