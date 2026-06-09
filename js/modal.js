// Modal Manager
class ModalManager {
    constructor() {
        this.modal = document.getElementById('gameModal');
        this.modalMessage = document.getElementById('modalMessage');
        this.isOpen = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close buttons
        const closeButtons = ['closeModal', 'closeModalBtn'];
        closeButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.close());
            }
        });

        // Play again button
        const playAgainBtn = document.getElementById('playAgainBtn');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                this.close();
                this.onPlayAgain();
            });
        }

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    open(message = 'GAME START!') {
        if (this.modalMessage) {
            this.modalMessage.textContent = message;
        }

        this.modal.style.display = 'block';
        this.isOpen = true;
        document.body.style.overflow = 'hidden';

        // Play sound if available
        if (window.audioManager) {
            window.audioManager.playStartSound();
        }
    }

    close() {
        this.modal.style.display = 'none';
        this.isOpen = false;
        document.body.style.overflow = '';
    }

    onPlayAgain() {
        // Reset game state or trigger action
        console.log('Play again triggered');
        if (window.gameState && window.gameState.resetGame) {
            window.gameState.resetGame();
        }
    }
}

// Create global modal instance
const modalManager = new ModalManager();
