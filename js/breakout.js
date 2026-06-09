// === BREAKOUT GAME ENGINE ===
// Brick types: 0=empty 1=normal 2=hard 3=explosive 4=indestructible
// Power-up types: 'multi','wide','slow','laser','extra'

class BreakoutGame {
    constructor(canvasEl) {
        this.canvas = canvasEl;
        this.ctx    = canvasEl.getContext('2d');

        this.state      = 'idle';
        this.score      = 0;
        this.lives      = 3;
        this.level      = 1;
        this.frameCount = 0;
        this.raf        = null;
        this.lastTime   = 0;

        this.paddle   = null;
        this.balls    = [];
        this.bricks   = [];
        this.powerUps = [];
        this.lasers   = [];
        this.particles= [];
        this.activePU = {};   // { type: expireFrame }

        // input
        this.keys   = {};
        this.mouseX = null;
        this._kd = this._onKeyDown.bind(this);
        this._ku = this._onKeyUp.bind(this);
        this._mm = this._onMouseMove.bind(this);
        this._tm = this._onTouchMove.bind(this);

        this.onScore  = null;
        this.onDeath  = null;
        this.onLife   = null;
        this.combo    = 0;
        this.comboTimer = 0;
        this.comboDisplay = null;  // { value, x, y, age }

        this._bindInput();
        this.resize();
    }

    // ─── Level layouts ───────────────────────────────────────
    _LEVELS = [
        // 1 - warm up
        [ [0,1,1,1,1,1,1,1,1,0],
          [1,2,1,2,1,2,1,2,1,1],
          [1,1,1,1,1,1,1,1,1,1],
          [0,1,2,1,2,1,2,1,1,0],
          [0,0,1,1,1,1,1,1,0,0] ],

        // 2 - fortress
        [ [4,2,2,2,2,2,2,2,2,4],
          [2,1,1,1,1,1,1,1,1,2],
          [2,1,3,1,2,2,1,3,1,2],
          [2,1,1,2,0,0,2,1,1,2],
          [4,2,2,2,2,2,2,2,2,4],
          [0,0,0,1,1,1,1,0,0,0] ],

        // 3 - diamond
        [ [0,0,0,0,2,2,0,0,0,0],
          [0,0,0,2,1,1,2,0,0,0],
          [0,0,2,1,3,3,1,2,0,0],
          [0,2,1,3,2,2,3,1,2,0],
          [2,1,1,1,2,2,1,1,1,2],
          [0,2,1,3,2,2,3,1,2,0],
          [0,0,2,1,3,3,1,2,0,0],
          [0,0,0,2,1,1,2,0,0,0] ],

        // 4 - chaos
        [ [4,1,3,1,2,2,1,3,1,4],
          [1,2,1,3,1,1,3,1,2,1],
          [3,1,2,1,4,4,1,2,1,3],
          [1,3,1,2,1,1,2,1,3,1],
          [2,1,4,1,3,3,1,4,1,2],
          [1,3,1,2,1,1,2,1,3,1],
          [4,1,2,1,3,3,1,2,1,4] ],

        // 5 - gauntlet
        [ [4,4,4,4,4,4,4,4,4,4],
          [4,3,2,3,2,2,3,2,3,4],
          [4,2,3,2,3,3,2,3,2,4],
          [4,3,2,3,2,2,3,2,3,4],
          [4,2,3,2,3,3,2,3,2,4],
          [4,3,2,3,2,2,3,2,3,4],
          [4,4,4,4,4,4,4,4,4,4] ],

        // 6 - zigzag
        [ [1,0,1,0,1,0,1,0,1,0],
          [0,2,0,2,0,2,0,2,0,2],
          [1,0,3,0,1,0,3,0,1,0],
          [0,2,0,2,0,2,0,2,0,2],
          [2,0,2,0,2,0,2,0,2,0],
          [0,3,0,1,0,1,0,3,0,1],
          [1,1,2,1,2,2,1,2,1,1] ],

        // 7 - spiral
        [ [2,2,2,2,2,2,2,2,2,2],
          [2,0,0,0,0,0,0,0,0,2],
          [2,0,3,3,3,3,3,3,0,2],
          [2,0,3,0,0,0,0,3,0,2],
          [2,0,3,0,1,1,0,3,0,2],
          [2,0,3,0,1,1,0,3,0,2],
          [2,0,3,0,0,0,0,3,0,2],
          [2,0,0,0,0,0,0,0,0,2],
          [2,2,2,2,2,2,2,2,2,2] ],

        // 8 - massacre
        [ [4,3,2,3,2,2,3,2,3,4],
          [3,2,3,2,3,3,2,3,2,3],
          [2,3,2,3,2,2,3,2,3,2],
          [3,2,3,4,3,3,4,3,2,3],
          [2,3,2,3,2,2,3,2,3,2],
          [3,2,3,2,3,3,2,3,2,3],
          [4,3,2,3,2,2,3,2,3,4],
          [3,2,3,2,3,3,2,3,2,3] ],
    ];

    // ─── Public API ──────────────────────────────────────────
    start() {
        this.score      = 0;
        this.lives      = 3;
        this.level      = 1;
        this.activePU   = {};
        this._buildLevel();
        this._resetBallPaddle();
        this.state      = 'playing';
        cancelAnimationFrame(this.raf);
        this.lastTime = 0;
        this.raf = requestAnimationFrame(t => this._loop(t));
    }

    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            cancelAnimationFrame(this.raf);
            this._drawPauseOverlay();
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.lastTime = 0;
            this.raf = requestAnimationFrame(t => this._loop(t));
        }
    }

    resize() {
        var wrapper = this.canvas.parentElement;
        if (!wrapper) return;
        var sz = Math.min(wrapper.clientWidth, wrapper.clientHeight);
        this.W = sz;
        this.H = sz;
        this.canvas.width  = sz;
        this.canvas.height = sz;
        if (this.paddle) {
            this.paddle.w = Math.round(sz * 0.22);
            this.paddle.h = Math.round(Math.max(8, sz * 0.028));
            this.paddle.y = sz - this.paddle.h - Math.round(sz * 0.04);
            if (this.paddle.x + this.paddle.w > sz) this.paddle.x = sz - this.paddle.w;
        }
        this._draw();
    }

    destroy() {
        cancelAnimationFrame(this.raf);
        document.removeEventListener('keydown', this._kd);
        document.removeEventListener('keyup',   this._ku);
        this.canvas.removeEventListener('mousemove', this._mm);
        this.canvas.removeEventListener('touchmove', this._tm);
    }

    // ─── Input ───────────────────────────────────────────────
    _bindInput() {
        document.addEventListener('keydown', this._kd);
        document.addEventListener('keyup',   this._ku);
        this.canvas.addEventListener('mousemove', this._mm, { passive: true });
        this.canvas.addEventListener('touchmove', this._tm, { passive: true });
    }

    _onKeyDown(e) {
        this.keys[e.key] = true;
        if (e.key === 'p' || e.key === 'P') this.togglePause();
        if ((e.key === ' ' || e.key === 'Enter') && this.state === 'idle') {
            this.state = 'playing';
        }
        if (e.key === 'z' || e.key === 'Z') this._fireLaser();
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
    }
    _onKeyUp(e)       { delete this.keys[e.key]; }
    _onMouseMove(e)   {
        var r = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - r.left;
    }
    _onTouchMove(e) {
        var r = this.canvas.getBoundingClientRect();
        this.mouseX = e.touches[0].clientX - r.left;
    }

    // ─── Build level ─────────────────────────────────────────
    _buildLevel() {
        var layout  = this._LEVELS[(this.level - 1) % this._LEVELS.length];
        var COLS    = 10;
        var padH    = Math.round(this.W * 0.04);
        var brickW  = Math.round((this.W - padH * 2) / COLS);
        var brickH  = Math.round(Math.max(10, this.W * 0.038));
        var gapY    = Math.round(this.H * 0.12);

        this.bricks = [];
        for (var row = 0; row < layout.length; row++) {
            for (var col = 0; col < COLS; col++) {
                var type = layout[row][col];
                if (type === 0) continue;
                this.bricks.push({
                    x:      padH + col * brickW,
                    y:      gapY + row * (brickH + 3),
                    w:      brickW - 3,
                    h:      brickH,
                    type:   type,
                    hp:     type === 2 ? 2 : type === 4 ? Infinity : 1,
                    maxHp:  type === 2 ? 2 : 1,
                    hit:    0,  // flash timer
                    row:    row,
                    col:    col,
                });
            }
        }
        this.powerUps = [];
        this.lasers   = [];
        this.activePU = {};
    }

    _resetBallPaddle() {
        var pw = Math.round(this.W * 0.22);
        var ph = Math.round(Math.max(8, this.W * 0.028));
        var py = this.H - ph - Math.round(this.H * 0.04);
        this.paddle = {
            x: (this.W - pw) / 2,
            y: py, w: pw, h: ph,
            baseW: pw,
            laser: false,
        };
        var speed = 3.5 + this.level * 0.4;
        this.balls = [{
            x:  this.W / 2,
            y:  py - 12,
            vx: speed * (Math.random() > 0.5 ? 0.6 : -0.6),
            vy: -speed,
            r:  Math.round(Math.max(5, this.W * 0.014)),
            trail: [],
        }];
        this.particles = [];
        this.combo     = 0;
        this.comboTimer= 0;
        this.comboDisplay = null;
    }

    // ─── Game loop ───────────────────────────────────────────
    _loop(timestamp) {
        if (this.state !== 'playing') return;
        if (!this.lastTime) this.lastTime = timestamp;
        var dt = Math.min((timestamp - this.lastTime) / (1000 / 60), 3);
        this.lastTime = timestamp;
        this.frameCount++;

        this._update(dt);
        this._draw();

        if (this.state === 'playing') {
            this.raf = requestAnimationFrame(t => this._loop(t));
        }
    }

    _update(dt) {
        this._movePaddle(dt);
        this._updateBalls(dt);
        this._updatePowerUps(dt);
        this._updateLasers(dt);
        this._updateParticles();
        this._expirePowerUps();
        if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
        if (this.comboDisplay) { this.comboDisplay.age += dt; if (this.comboDisplay.age > 60) this.comboDisplay = null; }

        // Check level complete
        if (this.bricks.every(b => b.type === 4 || b.hp <= 0)) {
            this._levelComplete();
        }
    }

    _movePaddle(dt) {
        var p   = this.paddle;
        var spd = this.W * 0.012 * dt;
        var wid = this._hasPU('wide') ? p.baseW * 1.5 : p.baseW;
        p.w     = Math.round(wid);

        if (this.mouseX !== null) {
            p.x = Math.max(0, Math.min(this.W - p.w, this.mouseX - p.w / 2));
        } else {
            if (this.keys['ArrowLeft']  || this.keys['a'] || this.keys['A']) p.x = Math.max(0, p.x - spd);
            if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) p.x = Math.min(this.W - p.w, p.x + spd);
        }
    }

    _updateBalls(dt) {
        var self = this;
        var dead = [];
        for (var i = 0; i < this.balls.length; i++) {
            var b = this.balls[i];
            var spd = this._hasPU('slow') ? 0.55 : 1;

            // Trail
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 7) b.trail.shift();

            b.x += b.vx * spd * dt;
            b.y += b.vy * spd * dt;

            // Wall bounces
            if (b.x - b.r < 0)       { b.x = b.r;          b.vx = Math.abs(b.vx); }
            if (b.x + b.r > this.W)   { b.x = this.W - b.r; b.vx = -Math.abs(b.vx); }
            if (b.y - b.r < 0)         { b.y = b.r;          b.vy = Math.abs(b.vy); }

            // Paddle
            if (this._ballHitPaddle(b)) {
                var p   = this.paddle;
                var rel = (b.x - (p.x + p.w / 2)) / (p.w / 2); // -1 to +1
                var ang = rel * 65 * (Math.PI / 180);
                var spd2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                b.vx = spd2 * Math.sin(ang);
                b.vy = -Math.abs(spd2 * Math.cos(ang));
                b.y  = this.paddle.y - b.r;
                if (window.audio) window.audio.select();
            }

            // Bricks
            this._checkBrickCollision(b);

            // Lost ball
            if (b.y - b.r > this.H) dead.push(i);
        }
        // Remove dead balls (reverse to preserve indices)
        for (var j = dead.length - 1; j >= 0; j--) this.balls.splice(dead[j], 1);

        if (this.balls.length === 0) {
            this._loseLife();
        }
    }

    _ballHitPaddle(b) {
        var p = this.paddle;
        return b.vy > 0 &&
               b.x + b.r > p.x && b.x - b.r < p.x + p.w &&
               b.y + b.r > p.y && b.y - b.r < p.y + p.h;
    }

    _checkBrickCollision(ball) {
        for (var i = 0; i < this.bricks.length; i++) {
            var br = this.bricks[i];
            if (br.hp <= 0) continue;
            if (!this._ballHitRect(ball, br)) continue;

            // Reflect ball
            var overlapLeft  = (ball.x + ball.r) - br.x;
            var overlapRight = (br.x + br.w) - (ball.x - ball.r);
            var overlapTop   = (ball.y + ball.r) - br.y;
            var overlapBot   = (br.y + br.h) - (ball.y - ball.r);
            var minX = Math.min(overlapLeft, overlapRight);
            var minY = Math.min(overlapTop,  overlapBot);
            if (br.type !== 4) {
                if (minX < minY) ball.vx = -ball.vx;
                else             ball.vy = -ball.vy;
            }

            if (br.type === 4) continue;

            br.hp--;
            br.hit = 8;

            if (br.hp <= 0) {
                this._destroyBrick(i, br);
            } else {
                if (window.audio) window.audio.select();
            }
            break;
        }
    }

    _ballHitRect(b, r) {
        var nearX = Math.max(r.x, Math.min(b.x, r.x + r.w));
        var nearY = Math.max(r.y, Math.min(b.y, r.y + r.h));
        var dx    = b.x - nearX;
        var dy    = b.y - nearY;
        return (dx * dx + dy * dy) < (b.r * b.r);
    }

    _destroyBrick(idx, br) {
        this.combo++;
        this.comboTimer = 90;
        var bonus = this.combo >= 8 ? 4 : this.combo >= 5 ? 3 : this.combo >= 3 ? 2 : 1;
        if (this.combo >= 3) {
            this.comboDisplay = { value: this.combo, x: br.x + br.w/2, y: br.y, age: 0 };
        }
        var pts  = br.type === 2 ? 20 : br.type === 3 ? 30 : 10;
        this.score += pts * this.level * bonus;
        this._spawnBrickParticles(br);

        if (br.type === 3) this._explodeBrick(br);

        // Maybe drop power-up (30% chance)
        if (Math.random() < 0.30) {
            var types = ['multi','wide','slow','extra','laser'];
            var pu    = types[Math.floor(Math.random() * types.length)];
            this.powerUps.push({
                x: br.x + br.w / 2,
                y: br.y + br.h / 2,
                type: pu,
                vy: 1.5 + Math.random(),
            });
        }

        if (this.onScore) this.onScore(this.score);
        if (window.audio) window.audio.eat();
    }

    _explodeBrick(center) {
        if (window.achievements) window.achievements.check('breakout_explosive');
        for (var i = 0; i < this.bricks.length; i++) {
            var b = this.bricks[i];
            if (b.hp <= 0 || b.type === 4) continue;
            if (Math.abs(b.row - center.row) <= 1 && Math.abs(b.col - center.col) <= 1) {
                b.hp   = 0;
                b.hit  = 8;
                this.score += 10 * this.level;
                this._spawnBrickParticles(b);
            }
        }
    }

    _updatePowerUps(dt) {
        for (var i = this.powerUps.length - 1; i >= 0; i--) {
            var pu = this.powerUps[i];
            pu.y += pu.vy * dt;
            // Caught by paddle
            var p = this.paddle;
            if (pu.y + 10 > p.y && pu.y < p.y + p.h &&
                pu.x > p.x && pu.x < p.x + p.w) {
                this._applyPowerUp(pu.type);
                this.powerUps.splice(i, 1);
            } else if (pu.y > this.H + 20) {
                this.powerUps.splice(i, 1);
            }
        }
    }

    _applyPowerUp(type) {
        if (window.audio) { window.audio.init(); window.audio.coin(); }
        if (window.achievements) window.achievements.check('breakout_powerup', { type: type });
        var dur = 300; // frames
        if (type === 'multi') {
            // Spawn 2 extra balls from existing balls
            var src = this.balls[0] || { x: this.W/2, y: this.H*0.5, vx: 3, vy: -3, r: Math.round(this.W*0.014), trail: [] };
            for (var k = 0; k < 2; k++) {
                var ang = ((k+1) * 60 - 60) * Math.PI / 180;
                var spd = Math.sqrt(src.vx*src.vx + src.vy*src.vy);
                this.balls.push({
                    x: src.x, y: src.y,
                    vx: spd * Math.cos(ang), vy: -Math.abs(spd * Math.sin(ang)) - 1,
                    r: src.r, trail: [],
                });
            }
        } else if (type === 'extra') {
            this.lives = Math.min(5, this.lives + 1);
            if (this.onLife) this.onLife(this.lives);
        } else {
            this.activePU[type] = this.frameCount + dur;
        }
        this.score += 50 * this.level;
        if (this.onScore) this.onScore(this.score);
    }

    _hasPU(type)    { return !!this.activePU[type] && this.activePU[type] > this.frameCount; }
    _expirePowerUps() {
        for (var k in this.activePU) {
            if (this.activePU[k] <= this.frameCount) delete this.activePU[k];
        }
        if (this._hasPU('laser')) this.paddle.laser = true;
        else this.paddle.laser = false;
    }

    _fireLaser() {
        if (!this._hasPU('laser')) return;
        var p = this.paddle;
        this.lasers.push({ x: p.x + p.w * 0.3, y: p.y, vy: -8 });
        this.lasers.push({ x: p.x + p.w * 0.7, y: p.y, vy: -8 });
    }

    _updateLasers(dt) {
        for (var i = this.lasers.length - 1; i >= 0; i--) {
            var l = this.lasers[i];
            l.y += l.vy * dt;
            if (l.y < -10) { this.lasers.splice(i, 1); continue; }
            // Hit bricks
            for (var j = 0; j < this.bricks.length; j++) {
                var br = this.bricks[j];
                if (br.hp <= 0 || br.type === 4) continue;
                if (l.x > br.x && l.x < br.x + br.w &&
                    l.y > br.y && l.y < br.y + br.h) {
                    br.hp = 0; br.hit = 8;
                    this._destroyBrick(j, br);
                    this.lasers.splice(i, 1);
                    break;
                }
            }
        }
    }

    _loseLife() {
        this.lives--;
        if (window.audio) window.audio.die();
        if (this.onLife) this.onLife(this.lives);
        if (this.lives <= 0) {
            this.state = 'dead';
            cancelAnimationFrame(this.raf);
            if (this.onDeath) this.onDeath(this.score);
            return;
        }
        this._resetBallPaddle();
    }

    _levelComplete() {
        if (window.audio) window.audio.highScore();
        if (window.achievements) window.achievements.check('breakout_levelclear');
        this.level++;
        var self = this;
        this.state = 'levelup';
        cancelAnimationFrame(this.raf);
        this._draw();
        this._drawCentreText('LEVEL ' + this.level + '!', '#ffff00');
        setTimeout(function() {
            self._buildLevel();
            self._resetBallPaddle();
            self.state = 'playing';
            self.lastTime = 0;
            self.raf = requestAnimationFrame(t => self._loop(t));
        }, 1800);
    }

    // ─── Particles ───────────────────────────────────────────
    _spawnBrickParticles(br) {
        var cx = br.x + br.w / 2;
        var cy = br.y + br.h / 2;
        var colors = { 1: '#00ffff', 2: '#ff7700', 3: '#ff00ff', 4: '#888' };
        var c = colors[br.type] || '#fff';
        for (var i = 0; i < 10; i++) {
            var a = Math.random() * Math.PI * 2;
            var s = 1.5 + Math.random() * 3;
            this.particles.push({ x: cx, y: cy, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
                life: 1, decay: 0.055 + Math.random()*0.04, size: 2+Math.random()*3, color: c });
        }
    }

    _updateParticles() {
        this.particles = this.particles.filter(p => p.life > 0);
        for (var p of this.particles) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= p.decay;
        }
    }

    // ─── Drawing ─────────────────────────────────────────────
    _draw() {
        var ctx = this.ctx;
        var W   = this.W;
        var H   = this.H;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        // subtle grid
        ctx.strokeStyle = 'rgba(0,255,255,0.03)';
        ctx.lineWidth   = 0.5;
        for (var i = 0; i < W; i += 20) {
            ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke();
        }

        this._drawBricks();
        this._drawPowerDrops();
        this._drawLasers();
        this._drawBalls();
        this._drawPaddle();
        this._drawParticles();

        // Combo display
        if (this.comboDisplay && this.combo >= 3) {
            var cd  = this.comboDisplay;
            var t   = cd.age / 60;
            var ctx = this.ctx;
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle   = this.combo >= 8 ? '#ff00ff' : this.combo >= 5 ? '#ffff00' : '#00ffff';
            ctx.font        = Math.round(this.W * 0.038) + 'px \'Press Start 2P\', monospace';
            ctx.textAlign   = 'center';
            ctx.fillText('x' + cd.value + ' COMBO!', cd.x, cd.y - t * 24);
            ctx.textAlign   = 'left';
            ctx.globalAlpha = 1;
        }
        // Combo streak bar (top of screen)
        if (this.combo >= 2) {
            var barW = Math.min(1, this.combo / 10) * this.W * 0.5;
            this.ctx.fillStyle = this.combo >= 8 ? '#ff00ff' : this.combo >= 5 ? '#ffff00' : '#00ffff';
            this.ctx.fillRect(this.W/2 - barW/2, 2, barW, 3);
        }

        if (this.state === 'idle')   this._drawCentreText('READY', 'rgba(0,255,255,0.8)');
        if (this.state === 'paused') this._drawPauseOverlay();
    }

    _drawBricks() {
        var ctx = this.ctx;
        var COLS_COLORS = [
            ['#00ffff','#00d4d4'],
            ['#ff00ff','#cc00cc'],
            ['#ffff00','#cccc00'],
            ['#00ff41','#00cc34'],
            ['#ff7700','#cc6000'],
            ['#ff4466','#cc3355'],
            ['#7744ff','#5533cc'],
            ['#44ffee','#33ccbb'],
        ];
        for (var i = 0; i < this.bricks.length; i++) {
            var br = this.bricks[i];
            if (br.hp <= 0) continue;
            var pair = COLS_COLORS[br.row % COLS_COLORS.length];

            if (br.type === 4) {
                ctx.fillStyle   = '#333';
                ctx.strokeStyle = '#666';
                ctx.lineWidth   = 1;
                ctx.fillRect(br.x, br.y, br.w, br.h);
                ctx.strokeRect(br.x+0.5, br.y+0.5, br.w-1, br.h-1);
                // diagonal hatch
                ctx.save();
                ctx.clip();
                ctx.strokeStyle = '#444';
                for (var x = br.x - br.h; x < br.x + br.w; x += 6) {
                    ctx.beginPath();
                    ctx.moveTo(x, br.y);
                    ctx.lineTo(x + br.h, br.y + br.h);
                    ctx.stroke();
                }
                ctx.restore();
                continue;
            }

            var flashMix = br.hit > 0 ? br.hit / 8 : 0;
            br.hit = Math.max(0, br.hit - 1);

            ctx.shadowColor = pair[0];
            ctx.shadowBlur  = flashMix > 0 ? 18 : (br.type === 3 ? 10 : 4);

            if (br.type === 2 && br.hp === 2) {
                // Hard brick — gradient + crack marks at hp=1 handled via opacity
                var grd = ctx.createLinearGradient(br.x, br.y, br.x+br.w, br.y+br.h);
                grd.addColorStop(0, '#ff9900');
                grd.addColorStop(1, '#ff4400');
                ctx.fillStyle = grd;
            } else if (br.type === 3) {
                ctx.fillStyle = '#ff00ff';
            } else {
                ctx.fillStyle = pair[0];
            }

            ctx.globalAlpha = 0.3 + flashMix * 0.5;
            ctx.fillRect(br.x, br.y, br.w, br.h);
            ctx.globalAlpha = 1;

            // Outline
            ctx.strokeStyle = flashMix > 0 ? '#fff' : pair[0];
            ctx.lineWidth   = 1.5;
            ctx.strokeRect(br.x+1, br.y+1, br.w-2, br.h-2);

            // Crack overlay on damaged hard brick
            if (br.type === 2 && br.hp === 1) {
                ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                ctx.lineWidth   = 1;
                ctx.beginPath();
                ctx.moveTo(br.x + br.w*0.3, br.y);
                ctx.lineTo(br.x + br.w*0.5, br.y + br.h*0.5);
                ctx.lineTo(br.x + br.w*0.7, br.y + br.h);
                ctx.stroke();
            }

            // Explosive X mark
            if (br.type === 3) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth   = 1;
                var pad = 3;
                ctx.beginPath();
                ctx.moveTo(br.x+pad, br.y+pad);
                ctx.lineTo(br.x+br.w-pad, br.y+br.h-pad);
                ctx.moveTo(br.x+br.w-pad, br.y+pad);
                ctx.lineTo(br.x+pad, br.y+br.h-pad);
                ctx.stroke();
            }
        }
        ctx.shadowBlur = 0;
    }

    _drawBalls() {
        var ctx = this.ctx;
        for (var b of this.balls) {
            // Trail
            for (var t = 0; t < b.trail.length; t++) {
                var alpha = (t / b.trail.length) * 0.4;
                ctx.globalAlpha = alpha;
                ctx.fillStyle   = '#00ffff';
                var tr = b.trail[t];
                ctx.beginPath();
                ctx.arc(tr.x, tr.y, b.r * (t / b.trail.length), 0, Math.PI*2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Ball
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur  = 14;
            var grad = ctx.createRadialGradient(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.1, b.x, b.y, b.r);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, '#00ffff');
            grad.addColorStop(1, '#004444');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    _drawPaddle() {
        var ctx = this.ctx;
        var p   = this.paddle;
        var col = this._hasPU('wide') ? '#ffff00' : this._hasPU('laser') ? '#ff4466' : '#ff00ff';
        ctx.shadowColor = col;
        ctx.shadowBlur  = 16;
        var grd = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
        grd.addColorStop(0, col);
        grd.addColorStop(1, col + '88');
        ctx.fillStyle = grd;
        ctx.beginPath();
        var r = Math.round(p.h / 2);
        ctx.roundRect(p.x, p.y, p.w, p.h, r);
        ctx.fill();
        // Highlight
        ctx.globalAlpha = 0.45;
        ctx.fillStyle   = '#fff';
        ctx.beginPath();
        ctx.roundRect(p.x + 4, p.y + 2, p.w - 8, Math.round(p.h * 0.35), r);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
    }

    _drawPowerDrops() {
        var ctx    = this.ctx;
        var labels = { multi:'M', wide:'W', slow:'S', extra:'+', laser:'L' };
        var colors = { multi:'#ff00ff', wide:'#ffff00', slow:'#00ffff', extra:'#00ff41', laser:'#ff4466' };
        for (var pu of this.powerUps) {
            var c = colors[pu.type] || '#fff';
            ctx.shadowColor = c;
            ctx.shadowBlur  = 10;
            ctx.strokeStyle = c;
            ctx.lineWidth   = 1.5;
            ctx.strokeRect(pu.x - 10, pu.y - 8, 20, 16);
            ctx.fillStyle   = c + '44';
            ctx.fillRect(pu.x - 10, pu.y - 8, 20, 16);
            ctx.fillStyle    = '#fff';
            ctx.font         = 'bold ' + Math.round(this.W * 0.025) + 'px monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labels[pu.type] || '?', pu.x, pu.y);
            ctx.shadowBlur   = 0;
        }
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    _drawLasers() {
        var ctx = this.ctx;
        ctx.shadowColor = '#ff4466';
        ctx.shadowBlur  = 8;
        ctx.strokeStyle = '#ff4466';
        ctx.lineWidth   = 2;
        for (var l of this.lasers) {
            ctx.beginPath();
            ctx.moveTo(l.x, l.y);
            ctx.lineTo(l.x, l.y + 12);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
    }

    _drawParticles() {
        var ctx = this.ctx;
        for (var p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle   = p.color;
            ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    _drawPauseOverlay() {
        var ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.fillRect(0, 0, this.W, this.H);
        this._drawCentreText('PAUSED', 'rgba(0,255,255,0.9)');
    }

    _drawCentreText(text, color) {
        var ctx  = this.ctx;
        var size = Math.max(8, Math.round(this.W * 0.042));
        ctx.font          = size + 'px \'Press Start 2P\', monospace';
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.fillStyle     = color;
        ctx.shadowColor   = color;
        ctx.shadowBlur    = 14;
        ctx.fillText(text, this.W / 2, this.H / 2);
        ctx.shadowBlur    = 0;
        ctx.textAlign     = 'left';
        ctx.textBaseline  = 'alphabetic';
    }
}
