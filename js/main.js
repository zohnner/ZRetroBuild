// Main Game State Manager
class GameState {
    constructor() {
        this.credits = 0;
        this.highScore = this.loadHighScore();
        this.players = 1;
        this.isPlaying = false;

        this.init();
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
        this.loadSavedData();
    }

    setupEventListeners() {
        // Start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => this.pressStart());
        }

        // Coin slot
        const coinSlot = document.getElementById('coinSlot');
        if (coinSlot) {
            coinSlot.addEventListener('click', () => this.insertCoin());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.pressStart();
            } else if (e.code === 'KeyC') {
                this.insertCoin();
            }
        });

        // Initialize audio on first user interaction
        const initAudio = () => {
            if (window.audioManager) {
                window.audioManager.init();
            }
            document.removeEventListener('click', initAudio);
            document.removeEventListener('keydown', initAudio);
        };

        document.addEventListener('click', initAudio);
        document.addEventListener('keydown', initAudio);
    }

    insertCoin() {
        this.credits++;
        this.playCoinAnimation();

        if (window.audioManager) {
            window.audioManager.playCoinSound();
        }

        this.updateUI();
        this.saveCredits();

        console.log(`💰 Credits: ${this.credits}`);
    }

    addCredits(amount = 1) {
        this.credits += amount;
        this.updateUI();
        this.saveCredits();
    }

    pressStart() {
        if (this.credits > 0) {
            this.credits--;
            this.startGame();
        } else {
            this.showNoCreditsMessage();
        }

        this.updateUI();
        this.saveCredits();
    }

    startGame() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        console.log('🎮 GAME STARTED! 🎮');

        // Show modal
        if (window.modalManager) {
            window.modalManager.open(`GAME STARTED! ${this.credits} CREDITS LEFT`);
        }

        // Update high score (simulated)
        this.updateHighScore();

        setTimeout(() => {
            this.isPlaying = false;
        }, 3000);
    }

    showNoCreditsMessage() {
        if (window.modalManager) {
            window.modalManager.open('⚠️ INSERT COIN ⚠️');
        }

        if (window.audioManager) {
            window.audioManager.playErrorSound();
        }

        // Shake effect
        const container = document.querySelector('.arcade-container');
        if (container) {
            container.style.animation = 'glitch 0.2s ease';
            setTimeout(() => {
                container.style.animation = '';
            }, 200);
        }
    }

    playCoinAnimation() {
        const coinSlot = document.getElementById('coinSlot');
        if (coinSlot) {
            const coin = document.createElement('div');
            coin.textContent = '💰';
            coin.style.cssText = [
                'position: fixed',
                'font-size: 1.5rem',
                'pointer-events: none',
                'z-index: 9999',
                'animation: coinDrop 0.5s ease forwards'
            ].join(';');

            const rect = coinSlot.getBoundingClientRect();
            coin.style.left = `${rect.left + rect.width / 2}px`;
            coin.style.top = `${rect.top}px`;

            document.body.appendChild(coin);
            setTimeout(() => coin.remove(), 600);
        }
    }

    updateHighScore() {
        const simulatedScore = Math.floor(Math.random() * 10000);
        if (simulatedScore > this.highScore) {
            this.highScore = simulatedScore;
            this.saveHighScore();
            this.updateUI();
            console.log(`🏆 NEW HIGH SCORE: ${this.highScore} 🏆`);
        }
    }

    updateUI() {
        const creditElement = document.getElementById('creditAmount');
        if (creditElement) {
            creditElement.textContent = this.credits;
        }

        const highScoreElement = document.getElementById('highScore');
        if (highScoreElement) {
            highScoreElement.textContent = this.highScore;
        }

        const playersElement = document.getElementById('playersCount');
        if (playersElement) {
            playersElement.textContent = this.players;
        }

        // Update start button state
        const startButton = document.getElementById('startButton');
        if (startButton) {
            if (this.credits === 0) {
                startButton.style.opacity = '0.5';
                startButton.style.cursor = 'not-allowed';
            } else {
                startButton.style.opacity = '1';
                startButton.style.cursor = 'pointer';
            }
        }
    }

    resetGame() {
        this.credits = 0;
        this.isPlaying = false;
        this.updateUI();
        this.saveCredits();
    }

    saveCredits() {
        try {
            localStorage.setItem('arcadeCredits', this.credits);
        } catch (e) {
            // localStorage may be unavailable in some contexts
        }
    }

    saveHighScore() {
        try {
            localStorage.setItem('arcadeHighScore', this.highScore);
        } catch (e) {
            // localStorage may be unavailable in some contexts
        }
    }

    loadHighScore() {
        try {
            const saved = localStorage.getItem('arcadeHighScore');
            return saved ? parseInt(saved, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    loadSavedData() {
        try {
            const savedCredits = localStorage.getItem('arcadeCredits');
            if (savedCredits) {
                this.credits = parseInt(savedCredits, 10);
                this.updateUI();
            }
        } catch (e) {
            // localStorage may be unavailable in some contexts
        }
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global game state
    window.gameState = new GameState();

    // Make audio manager globally available
    window.audioManager = audioManager;

    console.log('🕹️  ARCADE READY!');
    console.log('💡 TIPS:');
    console.log('   - Click the coin slot or press "C" to insert coin');
    console.log('   - Press START button, ENTER, or SPACE to play');
    console.log('   - Try the KONAMI CODE: ↑ ↑ ↓ ↓ ← → ← → B A');
    console.log('   - Your credits and high score are saved!');
});
