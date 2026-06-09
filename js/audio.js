// Audio Manager for Retro Sounds
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.enabled = false;
        this.sounds = {
            coin: null,
            start: null,
            error: null
        };
    }

    // Initialize audio on user interaction (required by browsers)
    init() {
        if (!this.audioContext && window.AudioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
            console.log('🎵 Audio system initialized');
        }
    }

    // Play a retro beep sound
    playBeep(frequency = 880, duration = 0.1, type = 'square') {
        if (!this.enabled || !this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.type = type;
            oscillator.frequency.value = frequency;

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.00001,
                this.audioContext.currentTime + duration
            );

            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }

    // Play coin insert sound
    playCoinSound() {
        this.playBeep(1200, 0.05, 'sine');
        setTimeout(() => {
            this.playBeep(800, 0.1, 'sine');
        }, 50);
    }

    // Play start game sound
    playStartSound() {
        this.playBeep(440, 0.1, 'square');
        setTimeout(() => {
            this.playBeep(880, 0.2, 'square');
        }, 100);
        setTimeout(() => {
            this.playBeep(1320, 0.3, 'square');
        }, 200);
    }

    // Play error sound
    playErrorSound() {
        this.playBeep(220, 0.2, 'sawtooth');
        setTimeout(() => {
            this.playBeep(176, 0.3, 'sawtooth');
        }, 150);
    }
}

// Create global audio instance
const audioManager = new AudioManager();
