// Konami Code Easter Egg
class KonamiCode {
    constructor() {
        // Konami Code sequence: ↑ ↑ ↓ ↓ ← → ← → B A
        this.code = [
            'ArrowUp', 'ArrowUp',
            'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight',
            'ArrowLeft', 'ArrowRight',
            'KeyB', 'KeyA'
        ];
        this.position = 0;
        this.activated = false;
        this.indicator = document.getElementById('easterEggIndicator');
        this.setupListener();
    }

    setupListener() {
        document.addEventListener('keydown', (e) => {
            if (this.activated) return;

            const key = e.code;
            const requiredKey = this.code[this.position];

            if (key === requiredKey) {
                this.position++;

                if (this.position === this.code.length) {
                    this.activate();
                }
            } else {
                this.position = 0;
            }
        });
    }

    activate() {
        this.activated = true;
        console.log('🎮 KONAMI CODE ACTIVATED! 🎮');

        // Show indicator
        if (this.indicator) {
            this.indicator.classList.add('active');
            setTimeout(() => {
                this.indicator.classList.remove('active');
            }, 3000);
        }

        // Trigger visual effects
        this.triggerEffects();

        // Add credits
        if (window.gameState && window.gameState.addCredits) {
            window.gameState.addCredits(10);
        }

        // Play sound
        if (window.audioManager) {
            window.audioManager.playBeep(660, 0.1, 'sine');
            setTimeout(() => window.audioManager.playBeep(880, 0.2, 'sine'), 100);
            setTimeout(() => window.audioManager.playBeep(1320, 0.3, 'sine'), 200);
        }

        // Reset after 5 seconds (can only activate once per session)
        setTimeout(() => {
            this.activated = false;
            this.position = 0;
        }, 5000);
    }

    triggerEffects() {
        // Rainbow border effect
        const container = document.querySelector('.arcade-container');
        if (container) {
            const colors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff00'];
            let i = 0;
            const interval = setInterval(() => {
                container.style.borderColor = colors[i % colors.length];
                container.style.boxShadow = `0 0 30px ${colors[i % colors.length]}`;
                i++;
                if (i > 20) {
                    clearInterval(interval);
                    container.style.borderColor = 'var(--neon-cyan)';
                    container.style.boxShadow =
                        '0 0 20px var(--neon-cyan), inset 0 0 10px var(--crt-glow)';
                }
            }, 100);
        }
    }
}

// Initialize Konami Code
const konamiCode = new KonamiCode();
