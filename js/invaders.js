// === SPACE INVADERS ENGINE ===
// Alien types: 0=squid(top) 1=crab(mid) 2=octopus(bottom)
class InvadersGame {
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
        this.combo      = 0;

        this.player   = null;
        this.bullets  = [];    // player bullets
        this.bombs    = [];    // alien bombs
        this.aliens   = [];
        this.bunkers  = [];
        this.ufo      = null;
        this.particles= [];
        this.explosions=[];

        // alien movement
        this.alienDir     = 1;   // 1=right -1=left
        this.alienDropY   = 0;
        this.alienSpeed   = 1;
        this.alienMoveTimer = 0;
        this.alienMoveInterval = 50; // frames between steps (decreases as aliens die)
        this.alienShootTimer  = 0;

        this.keys   = {};
        this._kd    = this._onKeyDown.bind(this);
        this._ku    = this._onKeyUp.bind(this);
        this._tm    = this._onTouchStart.bind(this);
        this._te    = this._onTouchEnd.bind(this);
        this._touchX= 0;

        this.onScore = null;
        this.onDeath = null;
        this.onLife  = null;

        this._bindInput();
        this.resize();
    }

    // ─── Alien sprite data (pixel art as bit arrays 8x8) ─────
    _SPRITES = {
        squid: [
            [0,0,1,1,1,1,0,0],
            [0,1,1,1,1,1,1,0],
            [1,1,0,1,1,0,1,1],
            [1,1,1,1,1,1,1,1],
            [0,1,0,1,1,0,1,0],
            [0,0,1,0,0,1,0,0],
            [0,1,0,1,1,0,1,0],
            [1,0,0,0,0,0,0,1],
        ],
        crab: [
            [0,0,0,1,1,0,0,0],
            [0,0,1,1,1,1,0,0],
            [0,1,1,0,0,1,1,0],
            [1,1,1,1,1,1,1,1],
            [1,0,1,1,1,1,0,1],
            [1,0,1,0,0,1,0,1],
            [0,0,0,1,1,0,0,0],
            [0,1,1,0,0,1,1,0],
        ],
        octopus: [
            [0,0,1,1,1,1,0,0],
            [1,1,1,1,1,1,1,1],
            [1,1,0,1,1,0,1,1],
            [1,1,1,1,1,1,1,1],
            [0,1,1,0,0,1,1,0],
            [1,0,0,1,1,0,0,1],
            [0,1,0,0,0,0,1,0],
            [0,0,1,0,0,1,0,0],
        ],
        ufo: [
            [0,0,1,1,1,1,1,1,1,1,0,0],
            [0,1,1,1,1,1,1,1,1,1,1,0],
            [1,0,1,0,1,1,1,1,0,1,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1],
            [0,1,0,1,0,1,1,0,1,0,1,0],
            [0,0,1,0,0,0,0,0,0,1,0,0],
        ],
    };

    // ─── Public API ──────────────────────────────────────────
    start() {
        this.score      = 0;
        this.lives      = 3;
        this.level      = 1;
        this.combo      = 0;
        this.ufo        = null;
        this.particles  = [];
        this.explosions = [];
        this._buildLevel(1);
        this.state      = 'playing';
        cancelAnimationFrame(this.raf);
        this.lastTime   = 0;
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
        this.W = sz; this.H = sz;
        this.canvas.width  = sz;
        this.canvas.height = sz;
        this._draw();
    }

    destroy() {
        cancelAnimationFrame(this.raf);
        document.removeEventListener('keydown', this._kd);
        document.removeEventListener('keyup',   this._ku);
        this.canvas.removeEventListener('touchstart', this._tm);
        this.canvas.removeEventListener('touchend',   this._te);
    }

    // ─── Input ───────────────────────────────────────────────
    _bindInput() {
        document.addEventListener('keydown', this._kd);
        document.addEventListener('keyup',   this._ku);
        this.canvas.addEventListener('touchstart', this._tm, { passive: true });
        this.canvas.addEventListener('touchend',   this._te, { passive: true });
    }
    _onKeyDown(e) {
        this.keys[e.key] = true;
        if (e.key === 'p' || e.key === 'P') { this.togglePause(); return; }
        if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            this._shoot();
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
    }
    _onKeyUp(e) { delete this.keys[e.key]; }
    _onTouchStart(e) {
        this._touchX = e.touches[0].clientX;
    }
    _onTouchEnd(e) {
        var dx = e.changedTouches[0].clientX - this._touchX;
        if (Math.abs(dx) < 15) this._shoot();
        else if (dx < 0 && this.player) this.player.vx = -this._playerSpeed();
        else if (dx > 0 && this.player) this.player.vx =  this._playerSpeed();
    }

    // ─── Build level ─────────────────────────────────────────
    _buildLevel(lvl) {
        var self = this;
        var COLS = 11, ROWS = 5;
        var alienW  = Math.round(this.W * 0.058);
        var alienH  = Math.round(this.W * 0.045);
        var alienGX = Math.round(this.W * 0.068);
        var alienGY = Math.round(this.H * 0.072);
        var startX  = Math.round(this.W * 0.06);
        var startY  = Math.round(this.H * 0.12);

        this.aliens = [];
        for (var row = 0; row < ROWS; row++) {
            for (var col = 0; col < COLS; col++) {
                var type = row === 0 ? 'squid' : row < 3 ? 'crab' : 'octopus';
                var pts  = row === 0 ? 30 : row < 3 ? 20 : 10;
                this.aliens.push({
                    x: startX + col * alienGX,
                    y: startY + row * alienGY,
                    w: alienW, h: alienH,
                    type: type,
                    pts: pts,
                    alive: true,
                    frame: 0,
                    col: col, row: row,
                });
            }
        }

        var pw = Math.round(this.W * 0.09);
        var ph = Math.round(Math.max(6, this.W * 0.018));
        this.player = {
            x: (this.W - pw) / 2,
            y: this.H - ph - Math.round(this.H * 0.04),
            w: pw, h: ph,
            vx: 0,
        };
        this.bullets = [];
        this.bombs   = [];

        // Build 4 bunkers
        this.bunkers = [];
        var bunkerW = Math.round(this.W * 0.09);
        var bunkerY = this.H - Math.round(this.H * 0.13);
        var bunkGap = (this.W - 4 * bunkerW) / 5;
        for (var i = 0; i < 4; i++) {
            this.bunkers.push(this._buildBunker(
                bunkGap + i * (bunkerW + bunkGap), bunkerY, bunkerW
            ));
        }

        // Difficulty scaling
        var base = Math.max(8, 50 - (lvl - 1) * 8);
        this.alienMoveInterval = base;
        this.alienSpeed        = 1 + (lvl - 1) * 0.5;
        this.alienDir          = 1;
        this.alienDropY        = 0;
        this.alienMoveTimer    = 0;
        this.alienShootTimer   = 0;
        this.ufo               = null;
    }

    _buildBunker(x, y, w) {
        // Bunker as pixel grid (5 cols x 4 rows)
        var h    = Math.round(w * 0.65);
        var cw   = Math.round(w / 5);
        var ch   = Math.round(h / 4);
        var pixels = [];
        var shape = [
            [1,1,1,1,1],
            [1,1,1,1,1],
            [1,1,0,1,1],
            [1,0,0,0,1],
        ];
        for (var r = 0; r < 4; r++) {
            for (var c = 0; c < 5; c++) {
                if (shape[r][c]) {
                    pixels.push({ x: x + c*cw, y: y + r*ch, w: cw-1, h: ch-1, hp: 3 });
                }
            }
        }
        return { x, y, w, h, pixels };
    }

    _playerSpeed() { return this.W * 0.008; }

    _shoot() {
        if (this.state !== 'playing') return;
        if (this.bullets.length >= 2) return; // max 2 player bullets
        var p = this.player;
        this.bullets.push({
            x: p.x + p.w / 2,
            y: p.y,
            w: 2, h: Math.round(this.H * 0.022),
            vy: -this.H * 0.016,
        });
        if (window.audio) window.audio.select();
    }

    // ─── Game loop ───────────────────────────────────────────
    _loop(timestamp) {
        if (this.state !== 'playing') return;
        if (!this.lastTime) this.lastTime = timestamp;
        var dt = Math.min((timestamp - this.lastTime) / (1000/60), 3);
        this.lastTime = timestamp;
        this.frameCount++;

        this._update(dt);
        this._draw();

        if (this.state === 'playing') {
            this.raf = requestAnimationFrame(t => this._loop(t));
        }
    }

    _update(dt) {
        this._movePlayer(dt);
        this._moveBullets(dt);
        this._moveBombs(dt);
        this._moveAliens(dt);
        this._moveUfo(dt);
        this._alienShoot();
        this._checkBulletAlien();
        this._checkBulletBunker();
        this._checkBombPlayer();
        this._checkBombBunker();
        this._checkAlienReachPlayer();
        this._updateParticles();
        this._updateExplosions();

        // Spawn UFO randomly
        if (!this.ufo && this.frameCount % 420 === 0 && Math.random() < 0.6) {
            this.ufo = {
                x: -Math.round(this.W * 0.08),
                y: Math.round(this.H * 0.06),
                w: Math.round(this.W * 0.09),
                h: Math.round(this.W * 0.04),
                vx: this.W * 0.005,
            };
        }
    }

    _movePlayer(dt) {
        var p   = this.player;
        var spd = this._playerSpeed() * dt;
        if (this.keys['ArrowLeft']  || this.keys['a'] || this.keys['A']) p.x -= spd * 2;
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) p.x += spd * 2;
        p.x = Math.max(0, Math.min(this.W - p.w, p.x));
    }

    _moveBullets(dt) {
        for (var i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].y += this.bullets[i].vy * dt;
            if (this.bullets[i].y < -10) this.bullets.splice(i, 1);
        }
    }

    _moveBombs(dt) {
        for (var i = this.bombs.length - 1; i >= 0; i--) {
            this.bombs[i].y += this.bombs[i].vy * dt;
            if (this.bombs[i].y > this.H + 10) this.bombs.splice(i, 1);
        }
    }

    _moveAliens(dt) {
        this.alienMoveTimer += dt;
        var alive = this.aliens.filter(a => a.alive);
        if (!alive.length) return;

        // Speed up as fewer aliens remain
        var ratio    = alive.length / (11 * 5);
        var interval = Math.max(4, this.alienMoveInterval * ratio);

        if (this.alienMoveTimer < interval) return;
        this.alienMoveTimer = 0;

        // Toggle animation frame
        alive.forEach(a => { a.frame = 1 - a.frame; });

        // Check wall hit
        var step = Math.round(this.alienSpeed * this.W * 0.012);
        var hitWall = alive.some(a =>
            (this.alienDir > 0 && a.x + a.w + step > this.W - 4) ||
            (this.alienDir < 0 && a.x - step < 4)
        );

        if (hitWall) {
            this.alienDir *= -1;
            var dropAmt = Math.round(this.H * 0.028);
            alive.forEach(a => { a.y += dropAmt; });
        } else {
            alive.forEach(a => { a.x += this.alienDir * step; });
        }
    }

    _moveUfo(dt) {
        if (!this.ufo) return;
        this.ufo.x += this.ufo.vx * dt * 60 / 60;
        if (this.ufo.x > this.W + this.ufo.w) this.ufo = null;
    }

    _alienShoot() {
        this.alienShootTimer++;
        var shootInterval = Math.max(20, 70 - this.level * 8);
        if (this.alienShootTimer < shootInterval) return;
        this.alienShootTimer = 0;

        // Pick a random alive alien from bottom rows
        var alive = this.aliens.filter(a => a.alive);
        if (!alive.length) return;
        var shooter = alive[Math.floor(Math.random() * alive.length)];
        this.bombs.push({
            x: shooter.x + shooter.w / 2,
            y: shooter.y + shooter.h,
            w: 2, h: Math.round(this.H * 0.02),
            vy: this.H * 0.009 + this.level * 0.003,
        });
    }

    _checkBulletAlien() {
        for (var bi = this.bullets.length - 1; bi >= 0; bi--) {
            var b = this.bullets[bi];
            var hit = false;
            for (var ai = 0; ai < this.aliens.length; ai++) {
                var a = this.aliens[ai];
                if (!a.alive) continue;
                if (b.x > a.x && b.x < a.x+a.w && b.y > a.y && b.y < a.y+a.h) {
                    a.alive = false;
                    this.combo++;
                    if (window.achievements) window.achievements.check('invaders_kill');
                    var bonus = this.combo >= 4 ? 2 : 1;
                    var pts   = a.pts * this.level * bonus;
                    this.score += pts;
                    this._spawnAlienParticles(a);
                    this._spawnExplosion(a.x + a.w/2, a.y + a.h/2, pts);
                    this.bullets.splice(bi, 1);
                    if (this.onScore) this.onScore(this.score);
                    if (window.audio) window.audio.eat();
                    hit = true;

                    // Check wave clear
                    if (!this.aliens.some(al => al.alive)) this._nextWave();
                    break;
                }
            }
            if (hit) continue;
            // Check UFO
            if (this.ufo && b.x > this.ufo.x && b.x < this.ufo.x+this.ufo.w &&
                            b.y > this.ufo.y && b.y < this.ufo.y+this.ufo.h) {
                var ufopts = (Math.floor(Math.random()*5)+1) * 50;
                this.score += ufopts * this.level;
                this._spawnExplosion(this.ufo.x + this.ufo.w/2, this.ufo.y, ufopts);
                this.ufo = null;
                if (window.achievements) window.achievements.check('invaders_ufo');
                this.bullets.splice(bi, 1);
                if (this.onScore) this.onScore(this.score);
                if (window.audio) window.audio.highScore();
            }
        }
    }

    _checkBulletBunker() {
        for (var bi = this.bullets.length - 1; bi >= 0; bi--) {
            var b = this.bullets[bi];
            for (var bunk of this.bunkers) {
                for (var pi = bunk.pixels.length - 1; pi >= 0; pi--) {
                    var px = bunk.pixels[pi];
                    if (b.x+b.w > px.x && b.x < px.x+px.w &&
                        b.y < px.y+px.h && b.y+b.h > px.y) {
                        px.hp--;
                        if (px.hp <= 0) bunk.pixels.splice(pi, 1);
                        if (bi < this.bullets.length) this.bullets.splice(bi, 1);
                        break;
                    }
                }
            }
        }
    }

    _checkBombPlayer() {
        var p = this.player;
        for (var i = this.bombs.length - 1; i >= 0; i--) {
            var b = this.bombs[i];
            if (b.x+b.w > p.x && b.x < p.x+p.w && b.y+b.h > p.y && b.y < p.y+p.h) {
                this.bombs.splice(i, 1);
                this._loseLife();
                break;
            }
        }
    }

    _checkBombBunker() {
        for (var bi = this.bombs.length - 1; bi >= 0; bi--) {
            var b = this.bombs[bi];
            for (var bunk of this.bunkers) {
                for (var pi = bunk.pixels.length - 1; pi >= 0; pi--) {
                    var px = bunk.pixels[pi];
                    if (b.x+b.w > px.x && b.x < px.x+px.w &&
                        b.y+b.h > px.y && b.y < px.y+px.h) {
                        px.hp--;
                        if (px.hp <= 0) bunk.pixels.splice(pi, 1);
                        if (bi < this.bombs.length) this.bombs.splice(bi, 1);
                        break;
                    }
                }
            }
        }
    }

    _checkAlienReachPlayer() {
        if (!this.player) return;
        for (var a of this.aliens) {
            if (a.alive && a.y + a.h >= this.player.y) {
                this._gameOver();
                return;
            }
        }
    }

    _loseLife() {
        if (window.audio) window.audio.die();
        this.lives--;
        this.combo = 0;
        if (this.onLife) this.onLife(this.lives);
        if (this.lives <= 0) { this._gameOver(); return; }
        // Reset player position
        var pw = this.player.w, ph = this.player.h;
        this.player.x = (this.W - pw) / 2;
        this.bullets  = [];
        this._spawnExplosion(this.player.x + pw/2, this.player.y, null);
    }

    _gameOver() {
        this.state = 'dead';
        cancelAnimationFrame(this.raf);
        if (this.onDeath) this.onDeath(this.score);
    }

    _nextWave() {
        this.level++;
        if (window.achievements) window.achievements.check('invaders_wave', { wave: this.level });
        var self = this;
        this.state = 'levelup';
        cancelAnimationFrame(this.raf);
        this._draw();
        this._drawCentreText('WAVE ' + this.level, '#ffff00');
        setTimeout(function() {
            self.bullets = []; self.bombs = [];
            self._buildLevel(self.level);
            self.state   = 'playing';
            self.lastTime= 0;
            self.raf = requestAnimationFrame(t => self._loop(t));
        }, 1600);
    }

    // ─── Particles & explosions ──────────────────────────────
    _spawnAlienParticles(a) {
        var colors = { squid:'#ff00ff', crab:'#ffff00', octopus:'#00ffff' };
        var c  = colors[a.type] || '#fff';
        var cx = a.x + a.w/2, cy = a.y + a.h/2;
        for (var i = 0; i < 12; i++) {
            var ang = (i/12)*Math.PI*2;
            var spd = 1.5 + Math.random()*3;
            this.particles.push({ x:cx, y:cy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
                life:1, decay:0.04+Math.random()*0.03, size:2+Math.random()*3, color:c });
        }
    }

    _spawnExplosion(x, y, pts) {
        this.explosions.push({ x, y, pts, age:0, maxAge:40 });
    }

    _updateParticles() {
        this.particles = this.particles.filter(p => p.life > 0);
        for (var p of this.particles) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= p.decay;
        }
    }

    _updateExplosions() {
        this.explosions = this.explosions.filter(e => e.age < e.maxAge);
        for (var e of this.explosions) e.age++;
    }

    // ─── Drawing ─────────────────────────────────────────────
    _draw() {
        var ctx = this.ctx;
        var W = this.W, H = this.H;
        ctx.clearRect(0,0,W,H);
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,W,H);

        // Scanline effect
        for (var y = 0; y < H; y += 4) {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(0, y, W, 2);
        }

        this._drawAliens();
        this._drawUfo();
        this._drawBunkers();
        this._drawPlayer();
        this._drawBullets();
        this._drawBombs();
        this._drawParticles();
        this._drawExplosions();
        this._drawGroundLine();

        if (this.state === 'idle')   this._drawCentreText('READY', 'rgba(0,255,255,0.8)');
        if (this.state === 'paused') this._drawPauseOverlay();
    }

    _drawAlien(ctx, alien, px, scale) {
        var sprite = this._SPRITES[alien.type];
        if (!sprite) return;
        // Alternate frame: shift by 1px for animation feel
        var frameOffset = alien.frame ? 1 : 0;
        var pw = Math.round(scale);
        var colors = { squid:'#ff00ff', crab:'#ffff00', octopus:'#00ff41' };
        ctx.fillStyle = colors[alien.type] || '#fff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur  = 4;
        for (var r = 0; r < sprite.length; r++) {
            for (var c = 0; c < sprite[r].length; c++) {
                if (sprite[r][c]) {
                    ctx.fillRect(
                        Math.round(px.x + (c + frameOffset * 0.5) * scale),
                        Math.round(px.y + r * scale),
                        pw, pw
                    );
                }
            }
        }
        ctx.shadowBlur = 0;
    }

    _drawAliens() {
        var ctx = this.ctx;
        for (var a of this.aliens) {
            if (!a.alive) continue;
            var scale = a.w / 8;
            this._drawAlien(ctx, a, a, scale);
        }
    }

    _drawUfo() {
        if (!this.ufo) return;
        var ctx = this.ctx;
        var u   = this.ufo;
        var sprite = this._SPRITES.ufo;
        var scale  = u.w / 12;
        ctx.fillStyle   = '#ff4466';
        ctx.shadowColor = '#ff4466';
        ctx.shadowBlur  = 10;
        for (var r = 0; r < sprite.length; r++) {
            for (var c = 0; c < sprite[r].length; c++) {
                if (sprite[r][c]) {
                    ctx.fillRect(
                        Math.round(u.x + c * scale),
                        Math.round(u.y + r * scale),
                        Math.round(scale), Math.round(scale)
                    );
                }
            }
        }
        ctx.shadowBlur = 0;
    }

    _drawBunkers() {
        var ctx = this.ctx;
        for (var bunk of this.bunkers) {
            for (var px of bunk.pixels) {
                var alpha = 0.4 + px.hp * 0.2;
                ctx.fillStyle = 'rgba(0,255,65,' + alpha + ')';
                ctx.fillRect(px.x, px.y, px.w, px.h);
            }
        }
    }

    _drawPlayer() {
        if (!this.player) return;
        var ctx = this.ctx;
        var p   = this.player;
        // Cannon shape
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = '#00ffff';
        // Base
        ctx.fillRect(p.x, p.y + Math.round(p.h*0.4), p.w, Math.round(p.h*0.6));
        // Body
        ctx.fillRect(p.x + Math.round(p.w*0.3), p.y + Math.round(p.h*0.15), Math.round(p.w*0.4), Math.round(p.h*0.4));
        // Barrel
        ctx.fillRect(p.x + Math.round(p.w*0.46), p.y, Math.round(p.w*0.08), Math.round(p.h*0.25));
        ctx.shadowBlur = 0;
    }

    _drawBullets() {
        var ctx = this.ctx;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur  = 6;
        ctx.fillStyle   = '#fff';
        for (var b of this.bullets) ctx.fillRect(b.x - b.w/2, b.y, b.w, b.h);
        ctx.shadowBlur = 0;
    }

    _drawBombs() {
        var ctx = this.ctx;
        for (var i = 0; i < this.bombs.length; i++) {
            var b = this.bombs[i];
            // Zigzag bomb
            var offset = (this.frameCount + i*7) % 4 < 2 ? -1 : 1;
            ctx.strokeStyle = '#ff7700';
            ctx.shadowColor = '#ff7700';
            ctx.shadowBlur  = 4;
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            ctx.moveTo(b.x + offset, b.y);
            ctx.lineTo(b.x - offset, b.y + b.h/2);
            ctx.lineTo(b.x + offset, b.y + b.h);
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

    _drawExplosions() {
        var ctx = this.ctx;
        for (var e of this.explosions) {
            var t = e.age / e.maxAge;
            if (e.pts) {
                ctx.globalAlpha = 1 - t;
                ctx.fillStyle   = '#ffff00';
                ctx.font        = Math.round(this.W * 0.025) + 'px \'Press Start 2P\', monospace';
                ctx.textAlign   = 'center';
                ctx.fillText('+' + e.pts, e.x, e.y - t * 18);
                ctx.textAlign   = 'left';
                ctx.globalAlpha = 1;
            }
            // Ring
            ctx.strokeStyle = 'rgba(255,255,255,' + (1-t) + ')';
            ctx.lineWidth   = 2;
            ctx.shadowColor = '#fff';
            ctx.shadowBlur  = 8*(1-t);
            ctx.beginPath();
            ctx.arc(e.x, e.y, t * Math.round(this.W*0.04), 0, Math.PI*2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    _drawGroundLine() {
        var ctx = this.ctx;
        var gy  = this.player ? this.player.y + this.player.h + 4 : this.H - 10;
        ctx.strokeStyle = '#00ff41';
        ctx.shadowColor = '#00ff41';
        ctx.shadowBlur  = 6;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(this.W, gy);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Lives icons
        for (var i = 0; i < this.lives - 1; i++) {
            ctx.fillStyle   = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur  = 4;
            var iw = Math.round(this.W * 0.045);
            ctx.fillRect(10 + i*(iw+6), gy + 5, iw, Math.round(iw*0.4));
            ctx.shadowBlur = 0;
        }
    }

    _drawPauseOverlay() {
        var ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.fillRect(0,0,this.W,this.H);
        this._drawCentreText('PAUSED', 'rgba(0,255,255,0.9)');
    }

    _drawCentreText(text, color) {
        var ctx  = this.ctx;
        var size = Math.max(8, Math.round(this.W * 0.042));
        ctx.font = size + 'px \'Press Start 2P\', monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14;
        ctx.fillText(text, this.W/2, this.H/2);
        ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
}
