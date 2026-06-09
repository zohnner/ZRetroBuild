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
        this.activeGame      = null;
        this._activeTab      = 'snake';
        this.gameInstance    = null;
        this._pendingScore   = 0;
        this._pendingIsHigh  = false;
        this._scoreSubmitted = false;
        this._gameSelect     = null;

        this._loadState();
        this._initStarfield();
        this._initGameSelect();
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

    _initGameSelect() {
        var self = this;
        this._gameSelect = new GameSelect(
            [
                { id: 'snake',    title: 'SNAKE',    tag: 'CLASSIC', color: '#00ffff' },
                { id: 'breakout', title: 'BREAKOUT', tag: 'NEW',     color: '#ff00ff' },
                { id: 'invaders', title: 'INVADERS', tag: 'HOT',     color: '#ff4466' },
            ],
            function(gameId) { self._launchGameById(gameId); }
        );
    }

    _initUI() {
        this._updateCreditDisplay(false);
        this._updateMuteIcon();
        this._renderScoreBoard('snake');
        document.getElementById('playerDisplay').textContent = this.players;
        if (window.achievements) {
            window.achievements.renderGallery(document.getElementById('achGallery'));
            this._updateAchCount();
        }
        this._bindScoreTabs();
    }

    _bindScoreTabs() {
        var self = this;
        var tabs = document.querySelectorAll('.score-tab');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                var game = tab.getAttribute('data-game');
                self._activeTab = game;
                self._renderScoreBoard(game);
                if (window.audio) { window.audio.init(); window.audio.select(); }
            });
        });
    }

    _updateAchCount() {
        var el = document.getElementById('achCount');
        if (el && window.achievements) {
            el.textContent = window.achievements.unlockedCount() + ' / 15';
        }
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
            var gVis = !document.getElementById('gameScreen').classList.contains('hidden');
            var sVis = !document.getElementById('selectScreen').classList.contains('hidden');
            if (!gVis && !sVis) {
                if (e.code === 'KeyC') { e.preventDefault(); self.insertCoin(); }
                if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); self.pressStart(); }
            }
            if (gVis && e.key === 'Escape') self.exitGame();
            if (sVis && e.key === 'Escape') self._cancelSelect();
        });

        document.getElementById('pauseBtn').addEventListener('click', function() {
            if (self.gameInstance && self.gameInstance.togglePause) self.gameInstance.togglePause();
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

        window.addEventListener('resize', function() {
            if (self.gameInstance && self.gameInstance.resize) self.gameInstance.resize();
        });
    }

    insertCoin() {
        window.audio.init();
        this.credits = Math.min(99, this.credits + 1);
        this._updateCreditDisplay(true);
        this._saveState();
        window.audio.coin();
        this._animateCoinDrop();
        if (window.achievements) window.achievements.check('coin');
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
        this._showGameSelect();
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

    _showGameSelect() {
        var splash = document.getElementById('splashScreen');
        var select = document.getElementById('selectScreen');
        splash.classList.add('exit');
        var self = this;
        setTimeout(function() {
            splash.style.display = 'none';
            splash.classList.remove('exit');
            self._gameSelect.show(select);
        }, 270);
    }

    _cancelSelect() {
        this._gameSelect.hide();
        this.credits = Math.min(99, this.credits + 1);
        this._updateCreditDisplay(false);
        this._saveState();
        var splash = document.getElementById('splashScreen');
        splash.style.display = '';
        this._renderScoreBoard(this._activeTab || 'snake');
    }

    _launchGameById(gameId) {
        this.activeGame = gameId;
        if (window.achievements) window.achievements.check('game_start', { game: gameId });
        var select = document.getElementById('selectScreen');
        select.classList.add('hidden');
        var gscr = document.getElementById('gameScreen');
        gscr.classList.remove('hidden');
        gscr.setAttribute('data-game', gameId);

        var nameEl = document.getElementById('gameName');
        if (nameEl) nameEl.textContent = '8-BIT ' + gameId.toUpperCase();

        var hints = { snake:'ARROWS / WASD / SWIPE', breakout:'MOUSE / ARROWS  Z=LASER', invaders:'ARROWS / WASD  SPACE=SHOOT' };
        var hintsEl = document.getElementById('gameHints');
        if (hintsEl) hintsEl.textContent = hints[gameId] || 'ARROWS / WASD';

        this._startGame(gameId);
    }

    _startGame(gameId) {
        var self   = this;
        var canvas = document.getElementById('gameCanvas');
        if (this.gameInstance) this.gameInstance.destroy();

        if (gameId === 'breakout') {
            this.gameInstance = new BreakoutGame(canvas);
            this.gameInstance.onScore = function(s) { self._onScore(s); };
            this.gameInstance.onDeath = function(s) { self._onDeath(s); };
            this.gameInstance.onLife  = function(l) { self._onLife(l); };
            this._initLivesDisplay(3);
        } else if (gameId === 'invaders') {
            this.gameInstance = new InvadersGame(canvas);
            this.gameInstance.onScore = function(s) { self._onScore(s); };
            this.gameInstance.onDeath = function(s) { self._onDeath(s); };
            this.gameInstance.onLife  = function(l) { self._onLife(l); };
            this._initLivesDisplay(3);
        } else {
            this.gameInstance = new SnakeGame(canvas);
            this.gameInstance.onScore = function(s) { self._onScore(s); };
            this.gameInstance.onDeath = function(s) { self._onDeath(s); };
            this._hideLivesDisplay();
        }

        this._setHUD(0);
        document.getElementById('liveBest').textContent =
            String(window.highScores.getTopScore(gameId)).padStart(5,'0');
        document.getElementById('gameOverlay').classList.add('hidden');
        this.gameInstance.start();
    }

    exitGame() {
        if (this.gameInstance) { this.gameInstance.destroy(); this.gameInstance = null; }
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('selectScreen').classList.add('hidden');
        var splash = document.getElementById('splashScreen');
        splash.style.display = '';
        document.getElementById('gameOverlay').classList.add('hidden');
        this._hideLivesDisplay();
        var tab = this.activeGame || this._activeTab || 'snake';
        this._renderScoreBoard(tab);
        this._updateTopScore(tab);
        if (window.achievements) {
            window.achievements.renderGallery(document.getElementById('achGallery'));
            this._updateAchCount();
        }
    }

    _restartGame() {
        if (this.credits > 0) { this.credits--; this._updateCreditDisplay(false); this._saveState(); }
        this._startGame(this.activeGame || 'snake');
    }

    _onScore(score) {
        this._setHUD(score);
        if (window.achievements) window.achievements.check('score', { score: score });
    }

    _onLife(lives) {
        var el = document.getElementById('livesDisplay');
        if (el) {
            var icons = '';
            for (var i = 0; i < lives; i++) icons += 'O ';
            el.textContent = 'LIVES  ' + icons.trim();
            el.classList.remove('hidden');
        }
    }

    _onDeath(score) {
        this._pendingScore   = score;
        this._pendingIsHigh  = window.highScores.isHighScore(score, this.activeGame);
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
        if (showInitials) {
            form.classList.remove('hidden');
            document.getElementById('initialsInput').value = '';
            setTimeout(function() { document.getElementById('initialsInput').focus(); }, 120);
        } else {
            form.classList.add('hidden');
        }
        document.getElementById('gameOverlay').classList.remove('hidden');
    }

    _saveScore() {
        if (this._scoreSubmitted) return;
        var initials = document.getElementById('initialsInput').value.trim() || 'AAA';
        if (this._pendingIsHigh && this._pendingScore > 0) {
            window.highScores.add(initials, this._pendingScore, this.activeGame);
            this._scoreSubmitted = true;
        }
        document.getElementById('initialsForm').classList.add('hidden');
        document.getElementById('liveBest').textContent =
            String(window.highScores.getTopScore(this.activeGame)).padStart(5,'0');
    }

    _setHUD(score) {
        var el = document.getElementById('liveScore');
        if (!el) return;
        el.textContent = String(score).padStart(5,'0');
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
    }

    _initLivesDisplay(lives) {
        var el = document.getElementById('livesDisplay');
        if (el) {
            var icons = '';
            for (var i = 0; i < lives; i++) icons += 'O ';
            el.textContent = 'LIVES  ' + icons.trim();
            el.classList.remove('hidden');
        }
    }

    _hideLivesDisplay() {
        var el = document.getElementById('livesDisplay');
        if (el) el.classList.add('hidden');
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

    _updateTopScore(gameId) {
        var el = document.getElementById('topScore');
        if (el) el.textContent = String(window.highScores.getTopScore(gameId)).padStart(5,'0');
    }

    _renderScoreBoard(gameId) {
        window.highScores.renderList(document.getElementById('scoreList'), gameId);
        this._updateTopScore(gameId);
        this._updateScoreTabs(gameId);
    }

    _updateScoreTabs(active) {
        var tabs = document.querySelectorAll('.score-tab');
        tabs.forEach(function(t) {
            var gid = t.getAttribute('data-game');
            t.classList.toggle('score-tab--active', gid === (active || 'snake'));
        });
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
    console.log('8-BIT ARCADE v3 - READY');
    console.log('  C = insert coin | ENTER/SPC = start | Konami = +30 credits');
});
