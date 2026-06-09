// === STARFIELD BACKGROUND ===
class Starfield {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.stars  = [];
        this._resize();
        this._animate();
        window.addEventListener('resize', this._resize.bind(this));
    }
    _resize() {
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.stars = [];
        for (var i = 0; i < 130; i++) this.stars.push(this._newStar(true));
    }
    _newStar(scatter) {
        var r = Math.random();
        return {
            x:       Math.random() * this.canvas.width,
            y:       scatter ? Math.random() * this.canvas.height : -2,
            size:    0.5 + Math.random() * 1.8,
            speed:   0.18 + Math.random() * 0.42,
            opacity: 0.15 + Math.random() * 0.55,
            color:   r < 0.15 ? '#ff00ff' : r < 0.32 ? '#00ffff' : '#e8f4f8'
        };
    }
    _animate() {
        var ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (var i = 0; i < this.stars.length; i++) {
            var s = this.stars[i];
            ctx.globalAlpha = s.opacity;
            ctx.fillStyle   = s.color;
            ctx.fillRect(s.x, s.y, s.size, s.size);
            s.y += s.speed;
            if (s.y > this.canvas.height) this.stars[i] = this._newStar(false);
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(this._animate.bind(this));
    }
}

// === MAIN GAME CONTROLLER ===
class GameController {
    constructor() {
        this.credits         = 0;
        this.players         = 1;
        this.snake           = null;
        this._pendingScore   = 0;
        this._pendingIsHigh  = false;
        this._scoreSubmitted = false;
        this._loadState();
        this._initStarfield();
        this._initUI();
        this._bindEvents();
    }

    _loadState() {
        try {
            this.credits = Math.min(99, parseInt(localStorage.getItem('arcadeCredits') || '0', 10));
            if (localStorage.getItem('arcadeMuted') === 'true') window.audio.muted = true;
        } catch(e) {}
    }
    _saveState() {
        try {
            localStorage.setItem('arcadeCredits', this.credits);
            localStorage.setItem('arcadeMuted', String(window.audio.muted));
        } catch(e) {}
    }

    _initStarfield() {
        var cvs = document.getElementById('bgCanvas');
        if (cvs) new Starfield(cvs);
    }

    _initUI() {
        this._updateCreditDisplay(false);
        this._updateMuteIcon();
        this._updateTopScore();
        this._renderScoreBoard();
        document.getElementById('playerDisplay').textContent = this.players;
    }

    _bindEvents() {
        var self = this;

        var slot = document.getElementById('coinSlot');
        slot.addEventListener('click', function() { self.insertCoin(); });
        slot.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') self.insertCoin();
        });

        document.getElementById('startBtn').addEventListener('click', function() { self.pressStart(); });
        document.getElementById('btn1P').addEventListener('click', function() { self._setPlayers(1); });
        document.getElementById('btn2P').addEventListener('click', function() { self._setPlayers(2); });
        document.getElementById('muteBtn').addEventListener('click', function() { self._toggleMute(); });

        document.addEventListener('keydown', function(e) {
            var gameVis = !document.getElementById('gameScreen').classList.contains('hidden');
            if (!gameVis) {
                if (e.code === 'KeyC') { e.preventDefault(); self.insertCoin(); }
                if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); self.pressStart(); }
            }
            if (gameVis && e.key === 'Escape') self.exitGame();
        });

        document.getElementById('pauseBtn').addEventListener('click', function() {
            if (self.snake) self.snake.togglePause();
        });
        document.getElementById('exitTopBtn').addEventListener('click', function() { self.exitGame(); });
        document.getElementById('exitBtn').addEventListener('click', function() { self.exitGame(); });
        document.getElementById('restartBtn').addEventListener('click', function() { self._restartGame(); });

        var inp = document.getElementById('initialsInput');
        inp.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        });
        inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') self._saveScore(); });
        document.getElementById('saveScoreBtn').addEventListener('click', function() { self._saveScore(); });

        window.addEventListener('resize', function() { if (self.snake) self.snake.resize(); });
    }

    insertCoin() {
        window.audio.init();
        this.credits = Math.min(99, this.credits + 1);
        this._updateCreditDisplay(true);
        this._saveState();
        window.audio.coin();
        this._animateCoinDrop();
    }

    addCredits(n) {
        this.credits = Math.min(99, this.credits + n);
        this._updateCreditDisplay(true);
        this._saveState();
    }

    pressStart() {
        window.audio.init();
        if (this.credits <= 0) { this._shakeStartBtn(); window.audio.error(); return; }
        this.credits--;
        this._updateCreditDisplay(false);
        this._saveState();
        window.audio.start();
        this._launchGame();
    }

    _setPlayers(n) {
        this.players = n;
        document.getElementById('btn1P').classList.toggle('player-btn--active', n === 1);
        document.getElementById('btn2P').classList.toggle('player-btn--active', n === 2);
        document.getElementById('playerDisplay').textContent = n;
        window.audio.init(); window.audio.select();
    }

    _toggleMute() {
        window.audio.init(); window.audio.toggle();
        this._updateMuteIcon(); this._saveState();
    }

    _launchGame() {
        var self = this;
        var splash = document.getElementById('splashScreen');
        var gscr   = document.getElementById('gameScreen');
        splash.classList.add('exit');
        setTimeout(function() {
            splash.style.display = 'none';
            splash.classList.remove('exit');
            gscr.classList.remove('hidden');
            self._startSnake();
        }, 270);
    }

    _startSnake() {
        var self = this;
        var canvas = document.getElementById('gameCanvas');
        if (this.snake) this.snake.destroy();
        this.snake = new SnakeGame(canvas);
        this.snake.onScore = function(s) { self._onScore(s); };
        this.snake.onDeath = function(s) { self._onDeath(s); };
        this._setHUD(0);
        document.getElementById('liveBest').textContent =
            String(window.highScores.getTopScore()).padStart(5, '0');
        document.getElementById('gameOverlay').classList.add('hidden');
        this.snake.start();
    }

    exitGame() {
        if (this.snake) { this.snake.destroy(); this.snake = null; }
        document.getElementById('gameScreen').classList.add('hidden');
        var splash = document.getElementById('splashScreen');
        splash.style.display = '';
        document.getElementById('gameOverlay').classList.add('hidden');
        this._renderScoreBoard();
        this._updateTopScore();
    }

    _restartGame() {
        if (this.credits > 0) { this.credits--; this._updateCreditDisplay(false); this._saveState(); }
        this._startSnake();
    }

    _onScore(score) { this._setHUD(score); }

    _onDeath(score) {
        this._pendingScore  = score;
        this._pendingIsHigh = window.highScores.isHighScore(score);
        this._scoreSubmitted = false;
        if (this._pendingIsHigh) {
            window.audio.highScore();
            this._showOverlay('NEW HIGH SCORE!', String(score).padStart(5,'0') + ' PTS', true);
        } else {
            this._showOverlay('GAME OVER', 'SCORE  ' + String(score).padStart(5,'0'), false);
        }
    }

    _showOverlay(title, sub, showInitials) {
        document.getElementById('overlayTitle').textContent    = title;
        document.getElementById('overlaySubtitle').textContent = sub;
        var form = document.getElementById('initialsForm');
        var inp  = document.getElementById('initialsInput');
        if (showInitials) {
            form.classList.remove('hidden');
            inp.value = '';
            setTimeout(function() { inp.focus(); }, 120);
        } else {
            form.classList.add('hidden');
        }
        document.getElementById('gameOverlay').classList.remove('hidden');
    }

    _saveScore() {
        if (this._scoreSubmitted) return;
        var initials = document.getElementById('initialsInput').value.trim() || 'AAA';
        if (this._pendingIsHigh && this._pendingScore > 0) {
            window.highScores.add(initials, this._pendingScore);
            this._scoreSubmitted = true;
        }
        document.getElementById('initialsForm').classList.add('hidden');
        document.getElementById('liveBest').textContent =
            String(window.highScores.getTopScore()).padStart(5,'0');
    }

    _setHUD(score) {
        var el = document.getElementById('liveScore');
        if (!el) return;
        el.textContent = String(score).padStart(5,'0');
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
    }

    _updateCreditDisplay(pop) {
        var el = document.getElementById('creditDisplay');
        if (!el) return;
        el.textContent = String(this.credits).padStart(2,'0');
        if (pop) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'scorePop 0.28s ease'; }
        var btn = document.getElementById('startBtn');
        if (btn) btn.classList.toggle('no-credits', this.credits === 0);
    }

    _updateMuteIcon() {
        var el = document.getElementById('muteIcon');
        if (el) el.textContent = window.audio.muted ? '[MUTE]' : '[SFX]';
    }

    _updateTopScore() {
        var el = document.getElementById('topScore');
        if (el) el.textContent = String(window.highScores.getTopScore()).padStart(5,'0');
    }

    _renderScoreBoard() {
        window.highScores.renderList(document.getElementById('scoreList'));
        this._updateTopScore();
    }

    _animateCoinDrop() {
        var slot = document.getElementById('coinSlot');
        if (!slot) return;
        var rect = slot.getBoundingClientRect();
        var el   = document.createElement('span');
        el.textContent = 'o';
        el.setAttribute('style', [
            'position:fixed', 'z-index:9999', 'pointer-events:none',
            'font-family:monospace', 'font-size:1.1rem',
            'color:#ffff00', 'text-shadow:0 0 8px #ffff00',
            'left:' + (rect.left + rect.width/2 - 8) + 'px',
            'top:' + rect.top + 'px',
            'animation:coinDrop 0.42s ease forwards'
        ].join(';'));
        document.body.appendChild(el);
        setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
    }

    _shakeStartBtn() {
        var btn = document.getElementById('startBtn');
        if (!btn) return;
        btn.style.animation = 'none';
        void btn.offsetWidth;
        btn.style.animation = 'shake 0.38s ease';
        setTimeout(function() { btn.style.animation = ''; }, 400);
    }
}

// === BOOT ===
document.addEventListener('DOMContentLoaded', function() {
    window.game = new GameController();
    console.log('8-BIT ARCADE - READY');
    console.log('  C = insert coin | ENTER/SPC = start | Konami = +30 credits');
});
