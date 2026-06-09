// === SNAKE GAME ENGINE (v2 — power-ups + levels) ===
class SnakeGame {
    constructor(canvasEl) {
        this.canvas = canvasEl;
        this.ctx    = canvasEl.getContext('2d');

        this.GRID  = 20;
        this.CELL  = 1;

        this.state      = 'idle';
        this.score      = 0;
        this.level      = 1;
        this.frameCount = 0;
        this.speed      = 8;
        this.multiplier = 1;
        this.multTimer  = 0;
        this.slowTimer  = 0;

        this.snake    = [];
        this.dir      = { x: 1, y: 0 };
        this.nextDir  = { x: 1, y: 0 };
        this.food      = null;
        this.bonusFood = null;  // { x, y, expires } high-value timed item
        this.powerUp  = null;  // { x, y, type, expires }
        this.walls    = [];    // obstacle cells for level 2+
        this.particles= [];

        this.raf       = null;
        this.lastTime  = 0;

        this.onScore  = null;
        this.onDeath  = null;

        this._keyHandler   = this._onKey.bind(this);
        this._touchStart   = null;
        this._touchStartXY = [0, 0];

        this._bindInput();
        this.resize();
    }

    // ─── Public API ──────────────────────────────────────────
    start() {
        var mid = Math.floor(this.GRID / 2);
        this.snake    = [{ x: mid, y: mid }, { x: mid-1, y: mid }, { x: mid-2, y: mid }];
        this.dir      = { x: 1, y: 0 };
        this.nextDir  = { x: 1, y: 0 };
        this.score    = 0;
        this.level    = 1;
        this.frameCount = 0;
        this.speed    = 8;
        this.multiplier = 1;
        this.multTimer  = 0;
        this.slowTimer  = 0;
        this.particles = [];
        this.powerUp  = null;
        this.bonusFood = null;
        this.walls    = [];
        this.state    = 'playing';

        this._placeFood();
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
        var size   = Math.min(wrapper.clientWidth, wrapper.clientHeight);
        this.CELL  = Math.max(1, Math.floor(size / this.GRID));
        var realSz = this.CELL * this.GRID;
        this.canvas.width  = realSz;
        this.canvas.height = realSz;
        this._draw();
    }

    destroy() {
        cancelAnimationFrame(this.raf);
        document.removeEventListener('keydown', this._keyHandler);
        if (this._touchStart) this.canvas.removeEventListener('touchstart', this._touchStart);
        if (this._touchEnd)   this.canvas.removeEventListener('touchend',   this._touchEnd);
    }

    // ─── Input ───────────────────────────────────────────────
    _bindInput() {
        document.addEventListener('keydown', this._keyHandler);
        this._touchStart = e => { this._touchStartXY = [e.touches[0].clientX, e.touches[0].clientY]; };
        this._touchEnd = e => {
            var [sx, sy] = this._touchStartXY;
            var dx = e.changedTouches[0].clientX - sx;
            var dy = e.changedTouches[0].clientY - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
            if (Math.abs(dx) > Math.abs(dy)) this._tryDir(dx > 0 ? { x:1,y:0 } : { x:-1,y:0 });
            else                             this._tryDir(dy > 0 ? { x:0,y:1 } : { x:0,y:-1 });
        };
        this.canvas.addEventListener('touchstart', this._touchStart, { passive: true });
        this.canvas.addEventListener('touchend',   this._touchEnd,   { passive: true });
    }

    _onKey(e) {
        var map = {
            ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1},
            ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0},
            w:{x:0,y:-1}, W:{x:0,y:-1}, s:{x:0,y:1}, S:{x:0,y:1},
            a:{x:-1,y:0}, A:{x:-1,y:0}, d:{x:1,y:0}, D:{x:1,y:0},
        };
        if (e.key === 'p' || e.key === 'P') { this.togglePause(); return; }
        var d = map[e.key];
        if (d) { e.preventDefault(); this._tryDir(d); }
    }

    _tryDir(d) {
        if (d.x === -this.dir.x && d.y === -this.dir.y) return;
        this.nextDir = d;
    }

    // ─── Levels ──────────────────────────────────────────────
    _levelWalls(lvl) {
        var walls = [];
        var G = this.GRID;
        if (lvl === 2) {
            // Horizontal bar with gap
            for (var i = 3; i < G-3; i++) {
                if (i < 8 || i > 12) walls.push({ x: i, y: Math.floor(G/2) });
            }
        } else if (lvl === 3) {
            // Corner blocks
            [[3,3],[4,3],[3,4],[G-4,3],[G-5,3],[G-4,4],
             [3,G-4],[4,G-4],[3,G-5],[G-4,G-4],[G-5,G-4],[G-4,G-5]
            ].forEach(function(p) { walls.push({ x:p[0], y:p[1] }); });
        } else if (lvl === 4) {
            // Plus sign
            for (var i = 4; i < G-4; i++) {
                walls.push({ x: i, y: Math.floor(G/2) });
                walls.push({ x: Math.floor(G/2), y: i });
            }
        } else if (lvl === 5) {
            // Diagonal stripes (wrap-through enabled at this level)
            for (var d = 4; d < G-4; d += 3) {
                walls.push({ x: d, y: d });
                walls.push({ x: G-1-d, y: d });
            }
        } else if (lvl === 6) {
            // Two vertical bars with gaps
            for (var r = 2; r < G-2; r++) {
                if (r < 7 || r > 13) {
                    walls.push({ x: Math.floor(G/3),   y: r });
                    walls.push({ x: Math.floor(2*G/3), y: r });
                }
            }
        } else if (lvl === 7) {
            // Ring
            for (var a = 0; a < 360; a += 18) {
                var rad = a * Math.PI / 180;
                var rx  = Math.round(G/2 + 5 * Math.cos(rad));
                var ry  = Math.round(G/2 + 5 * Math.sin(rad));
                if (rx >= 0 && rx < G && ry >= 0 && ry < G) walls.push({ x: rx, y: ry });
            }
        } else if (lvl === 8) {
            // Scattered dense
            for (var j = 0; j < 16; j++) {
                walls.push({ x: 2 + Math.floor(Math.random()*(G-4)), y: 2 + Math.floor(Math.random()*(G-4)) });
            }
        } else if (lvl === 9) {
            // Checkerboard quarter
            for (var cy = 2; cy < Math.floor(G/2); cy += 2) {
                for (var cx = 2; cx < Math.floor(G/2); cx += 2) {
                    walls.push({ x: cx, y: cy });
                    walls.push({ x: G-1-cx, y: G-1-cy });
                }
            }
        } else if (lvl >= 10) {
            // Spiral
            var dirs = [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
            var wx2=1, wy2=1, di=0, steps=G-2, taken=0, total=0;
            while (total < 24) {
                walls.push({ x: wx2, y: wy2 });
                wx2 += dirs[di].x; wy2 += dirs[di].y; taken++; total++;
                if (taken === steps) { di=(di+1)%4; taken=0; if (di%2===0) steps--; }
                if (wx2<0||wx2>=G||wy2<0||wy2>=G) break;
            }
        }
        return walls;
    }

    _advanceLevel() {
        this.level++;
        this.walls = this._levelWalls(this.level);
        this.speed = Math.max(3, 8 - Math.min(this.level, 6));
        if (window.achievements) window.achievements.check('snake_level', { level: this.level });
        // Remove any wall that's on the snake
        var self = this;
        this.walls = this.walls.filter(function(w) {
            return !self.snake.some(function(s) { return s.x === w.x && s.y === w.y; });
        });
    }

    // ─── Game loop ───────────────────────────────────────────
    _loop(timestamp) {
        if (this.state !== 'playing') return;
        if (!this.lastTime) this.lastTime = timestamp;
        var delta = timestamp - this.lastTime;

        if (delta >= 1000 / 60) {
            this.lastTime = timestamp;
            this.frameCount++;

            if (this.frameCount % this.speed === 0) this._update();

            if (this.state === 'playing') {
                this._updateParticles();
                this._draw();
            }
        }
        if (this.state === 'playing') this.raf = requestAnimationFrame(t => this._loop(t));
    }

    // ─── Update ──────────────────────────────────────────────
    _update() {
        this.dir = { ...this.nextDir };
        var head    = this.snake[0];
        var newHead = { x: head.x + this.dir.x, y: head.y + this.dir.y };

        // Wall collision — wrap at level 5+, die otherwise
        if (newHead.x < 0 || newHead.x >= this.GRID || newHead.y < 0 || newHead.y >= this.GRID) {
            if (this.level >= 5) {
                newHead.x = (newHead.x + this.GRID) % this.GRID;
                newHead.y = (newHead.y + this.GRID) % this.GRID;
            } else {
                this._die(); return;
            }
        }
        // Self collision
        for (var seg of this.snake) {
            if (seg.x === newHead.x && seg.y === newHead.y) { this._die(); return; }
        }
        // Obstacle collision
        for (var w of this.walls) {
            if (w.x === newHead.x && w.y === newHead.y) { this._die(); return; }
        }

        this.snake.unshift(newHead);

        // Eat food
        if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
            var pts = 10 * this.level * this.multiplier;
            this.score += pts;
            this._spawnEatParticles(newHead);
            this._placeFood();
            if (this.score % 100 === 0) this._advanceLevel();
            if (this.onScore) this.onScore(this.score);
            if (window.audio) window.audio.eat();
            if (window.achievements) { window.achievements.check('score', { score: this.score }); window.achievements.check('snake_length', { length: this.snake.length }); }

            // Maybe spawn a power-up or bonus food
            if (!this.powerUp && Math.random() < 0.20) this._spawnPowerUp();
            if (!this.bonusFood && Math.random() < 0.15) this._spawnBonusFood();
        } else {
            this.snake.pop();
        }

        // Eat bonus food
        if (this.bonusFood && newHead.x === this.bonusFood.x && newHead.y === this.bonusFood.y) {
            var bpts = 30 * this.level * this.multiplier;
            this.score += bpts;
            this._spawnEatParticles(newHead);
            this.bonusFood = null;
            if (this.onScore) this.onScore(this.score);
            if (window.audio) { window.audio.init(); window.audio.coin(); }
        }
        if (this.bonusFood && this.frameCount > this.bonusFood.expires) this.bonusFood = null;

        // Eat power-up
        if (this.powerUp && newHead.x === this.powerUp.x && newHead.y === this.powerUp.y) {
            this._applyPowerUp(this.powerUp.type);
            this.powerUp = null;
        }

        // Expire power-up on board
        if (this.powerUp && this.frameCount > this.powerUp.expires) this.powerUp = null;

        // Tick timers
        if (this.multTimer > 0) { this.multTimer--; if (this.multTimer === 0) this.multiplier = 1; }
        if (this.slowTimer > 0) { this.slowTimer--; }
    }

    _die() {
        this.state = 'dead';
        cancelAnimationFrame(this.raf);
        this._spawnDeathParticles();
        var self  = this;
        var ticks = 0;
        var burst = function() {
            self._updateParticles();
            self._draw();
            if (++ticks < 30 && self.particles.length) requestAnimationFrame(burst);
            else if (self.onDeath) self.onDeath(self.score);
        };
        requestAnimationFrame(burst);
        if (window.audio) window.audio.die();
    }

    // ─── Food & Power-ups ────────────────────────────────────
    _placeFood() {
        var pos;
        do {
            pos = { x: Math.floor(Math.random()*this.GRID), y: Math.floor(Math.random()*this.GRID) };
        } while (this._occupied(pos));
        this.food = pos;
    }

    _spawnPowerUp() {
        var pos;
        var attempts = 0;
        do {
            pos = { x: Math.floor(Math.random()*this.GRID), y: Math.floor(Math.random()*this.GRID) };
            attempts++;
        } while (this._occupied(pos) && attempts < 40);
        if (attempts >= 40) return;
        var types = ['slow', '2x', 'shrink'];
        this.powerUp = {
            x: pos.x, y: pos.y,
            type: types[Math.floor(Math.random() * types.length)],
            expires: this.frameCount + 120,  // 120 ticks ~= a few seconds
        };
    }

    _applyPowerUp(type) {
        if (window.audio) { window.audio.init(); window.audio.coin(); }
        if (window.achievements) window.achievements.check('snake_powerup', { type: type });
        if (type === 'slow') {
            this.slowTimer = 200;
            if (this.speed < 14) this.speed += 3;
        } else if (type === '2x') {
            this.multiplier = 2;
            this.multTimer  = 150;
        } else if (type === 'shrink') {
            var remove = Math.min(4, this.snake.length - 3);
            for (var i = 0; i < remove; i++) this.snake.pop();
            this._spawnShrinkParticles();
        }
        if (this.onScore) this.onScore(this.score);
    }

    _spawnBonusFood() {
        var pos;
        var attempts = 0;
        do {
            pos = { x: Math.floor(Math.random()*this.GRID), y: Math.floor(Math.random()*this.GRID) };
            attempts++;
        } while (this._occupied(pos) && attempts < 40);
        if (attempts >= 40) return;
        this.bonusFood = { x: pos.x, y: pos.y, expires: this.frameCount + 100 };
    }

    _occupied(pos) {
        if (this.food && this.food.x === pos.x && this.food.y === pos.y) return true;
        for (var s of this.snake) if (s.x === pos.x && s.y === pos.y) return true;
        for (var w of this.walls) if (w.x === pos.x && w.y === pos.y) return true;
        return false;
    }

    // ─── Particles ───────────────────────────────────────────
    _spawnEatParticles(pos) {
        var cx = pos.x * this.CELL + this.CELL/2;
        var cy = pos.y * this.CELL + this.CELL/2;
        for (var i = 0; i < 10; i++) {
            var a = (i/10) * Math.PI*2;
            var s = 1.5 + Math.random()*2.5;
            this.particles.push({ x:cx, y:cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
                life:1, decay:0.07, size:3, color:'#ff00ff' });
        }
    }

    _spawnDeathParticles() {
        for (var seg of this.snake) {
            var cx = seg.x * this.CELL + this.CELL/2;
            var cy = seg.y * this.CELL + this.CELL/2;
            for (var i = 0; i < 5; i++) {
                var a = Math.random()*Math.PI*2;
                var s = 1 + Math.random()*3.5;
                this.particles.push({ x:cx, y:cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 0.5,
                    life:1, decay:0.028+Math.random()*0.03, size:2+Math.random()*2.5, color:'#00ff41' });
            }
        }
    }

    _spawnShrinkParticles() {
        var tail = this.snake[this.snake.length-1];
        if (!tail) return;
        var cx = tail.x * this.CELL + this.CELL/2;
        var cy = tail.y * this.CELL + this.CELL/2;
        for (var i = 0; i < 14; i++) {
            var a = Math.random()*Math.PI*2;
            this.particles.push({ x:cx, y:cy, vx:Math.cos(a)*3, vy:Math.sin(a)*3,
                life:1, decay:0.05, size:2, color:'#7744ff' });
        }
    }

    _updateParticles() {
        this.particles = this.particles.filter(p => p.life > 0);
        for (var p of this.particles) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay;
        }
    }

    // ─── Drawing ─────────────────────────────────────────────
    _draw() {
        var ctx = this.ctx;
        var C   = this.CELL;
        var G   = this.GRID;
        var W   = C * G;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, W);

        // Grid lines
        ctx.strokeStyle = 'rgba(0,255,65,0.05)';
        ctx.lineWidth   = 0.5;
        for (var i = 0; i <= G; i++) {
            ctx.beginPath(); ctx.moveTo(i*C,0); ctx.lineTo(i*C,W); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,i*C); ctx.lineTo(W,i*C); ctx.stroke();
        }

        // Obstacle walls
        ctx.fillStyle   = '#334';
        ctx.strokeStyle = '#556';
        ctx.lineWidth   = 1;
        for (var wl of this.walls) {
            ctx.fillRect(wl.x*C, wl.y*C, C, C);
            ctx.strokeRect(wl.x*C+1, wl.y*C+1, C-2, C-2);
            // X mark
            ctx.strokeStyle = '#778';
            ctx.beginPath();
            ctx.moveTo(wl.x*C+3, wl.y*C+3);
            ctx.lineTo(wl.x*C+C-3, wl.y*C+C-3);
            ctx.moveTo(wl.x*C+C-3, wl.y*C+3);
            ctx.lineTo(wl.x*C+3, wl.y*C+C-3);
            ctx.stroke();
            ctx.strokeStyle = '#556';
        }

        // Power-up on board
        if (this.powerUp) {
            var puColors = { slow:'#00ffff', '2x':'#ffff00', shrink:'#7744ff' };
            var puLabels = { slow:'S', '2x':'2X', shrink:'<' };
            var puc = puColors[this.powerUp.type] || '#fff';
            var pulse = 0.6 + 0.4 * Math.sin(this.frameCount * 0.2);
            ctx.shadowColor  = puc;
            ctx.shadowBlur   = 12 * pulse;
            ctx.strokeStyle  = puc;
            ctx.lineWidth    = 1.5;
            ctx.strokeRect(this.powerUp.x*C+1, this.powerUp.y*C+1, C-2, C-2);
            ctx.fillStyle    = puc + '44';
            ctx.fillRect(this.powerUp.x*C+1, this.powerUp.y*C+1, C-2, C-2);
            ctx.fillStyle    = '#fff';
            ctx.font         = 'bold ' + Math.max(7, Math.round(C*0.52)) + 'px monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(puLabels[this.powerUp.type]||'?', this.powerUp.x*C+C/2, this.powerUp.y*C+C/2);
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.shadowBlur   = 0;
        }

        // Bonus food (orange star, limited time)
        if (this.bonusFood) {
            var bpulse = 0.5 + 0.5 * Math.sin(this.frameCount * 0.4);
            var brem   = Math.max(0, (this.bonusFood.expires - this.frameCount) / 100);
            ctx.shadowBlur  = 16 * bpulse;
            ctx.shadowColor = '#ff7700';
            ctx.fillStyle   = 'rgba(255,120,0,' + (0.6 + 0.4*bpulse) + ')';
            ctx.fillRect(this.bonusFood.x*C+2, this.bonusFood.y*C+2, C-4, C-4);
            ctx.fillStyle = '#ffdd00';
            ctx.font      = 'bold ' + Math.max(6, Math.round(C*0.55)) + 'px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('3X', this.bonusFood.x*C+C/2, this.bonusFood.y*C+C/2);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            // Time bar across bottom of cell
            ctx.fillStyle = 'rgba(255,120,0,' + brem + ')';
            ctx.fillRect(this.bonusFood.x*C, this.bonusFood.y*C+C-2, Math.round(C*brem), 2);
            ctx.shadowBlur = 0;
        }

        // Food
        if (this.food) {
            var fpulse = 0.65 + 0.35 * Math.sin(this.frameCount * 0.22);
            var pad    = 2;
            ctx.shadowBlur  = 14 * fpulse;
            ctx.shadowColor = '#ff00ff';
            ctx.fillStyle   = 'rgba(255,0,255,' + (0.75 + 0.25*fpulse) + ')';
            ctx.fillRect(this.food.x*C+pad, this.food.y*C+pad, C-pad*2, C-pad*2);
            ctx.fillStyle   = '#fff';
            var d = Math.max(2, C*0.2);
            ctx.fillRect(this.food.x*C+C/2-d/2, this.food.y*C+C/2-d/2, d, d);
            ctx.shadowBlur  = 0;
        }

        // Snake
        for (var si = 0; si < this.snake.length; si++) {
            var seg    = this.snake[si];
            var isHead = si === 0;
            var t      = si / this.snake.length;

            if (isHead) {
                var headColor = this.multiplier > 1 ? '#ffff00' : '#00ffff';
                ctx.fillStyle   = headColor;
                ctx.shadowColor = headColor;
                ctx.shadowBlur  = 10;
            } else {
                var g = Math.round(255 - t*130);
                var b = Math.round(65  + t*40);
                ctx.fillStyle   = this.multiplier > 1 ? 'rgb(220,' + Math.round(220-t*80) + ',0)' : 'rgb(0,' + g + ',' + b + ')';
                ctx.shadowColor = this.multiplier > 1 ? '#ffff00' : '#00ff41';
                ctx.shadowBlur  = 3;
            }

            var spad = isHead ? 1 : 2;
            ctx.fillRect(seg.x*C+spad, seg.y*C+spad, C-spad*2, C-spad*2);

            if (isHead) {
                ctx.shadowBlur  = 0;
                ctx.fillStyle   = '#000510';
                var eyeSize     = Math.max(2, Math.floor(C*0.18));
                var eyes        = this._eyePositions(seg, C);
                ctx.fillRect(eyes[0].x, eyes[0].y, eyeSize, eyeSize);
                ctx.fillRect(eyes[1].x, eyes[1].y, eyeSize, eyeSize);
            }
        }
        ctx.shadowBlur = 0;

        // Particles
        for (var pc of this.particles) {
            ctx.globalAlpha = Math.max(0, pc.life);
            ctx.fillStyle   = pc.color;
            ctx.fillRect(pc.x - pc.size/2, pc.y - pc.size/2, pc.size, pc.size);
        }
        ctx.globalAlpha = 1;

        // Active power-up HUD overlay (top-left corner of canvas)
        if (this.multTimer > 0) {
            ctx.fillStyle = 'rgba(255,255,0,0.85)';
            ctx.font      = 'bold ' + Math.max(6, Math.round(C*0.45)) + 'px monospace';
            ctx.fillText('2X ' + this.multTimer, 4, C - 2);
        }
        if (this.slowTimer > 0) {
            ctx.fillStyle = 'rgba(0,255,255,0.85)';
            ctx.font      = 'bold ' + Math.max(6, Math.round(C*0.45)) + 'px monospace';
            ctx.fillText('SLOW ' + this.slowTimer, 4, C*2 - 2);
        }

        if (this.state === 'idle')   this._drawCentreText('READY', 'rgba(0,255,255,0.2)');
        if (this.state === 'paused') this._drawPauseOverlay();
    }

    _eyePositions(seg, C) {
        var d   = this.dir;
        var es  = Math.max(2, Math.floor(C*0.18));
        var off = Math.floor(C*0.2);
        var ax, ay, bx, by;
        if (d.x !== 0) {
            ax = seg.x*C + (d.x > 0 ? C-off-es : off); ay = seg.y*C + off;
            bx = ax; by = seg.y*C + C-off-es;
        } else {
            ax = seg.x*C + off; ay = seg.y*C + (d.y > 0 ? C-off-es : off);
            bx = seg.x*C + C-off-es; by = ay;
        }
        return [{ x:ax, y:ay }, { x:bx, y:by }];
    }

    _drawPauseOverlay() {
        var ctx = this.ctx;
        var W   = this.CELL * this.GRID;
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.fillRect(0, 0, W, W);
        this._drawCentreText('PAUSED', 'rgba(0,255,255,0.9)');
    }

    _drawCentreText(text, color) {
        var ctx  = this.ctx;
        var W    = this.CELL * this.GRID;
        var size = Math.max(8, Math.floor(this.CELL * 0.75));
        ctx.font          = size + 'px \'Press Start 2P\', monospace';
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.fillStyle     = color;
        ctx.shadowColor   = color;
        ctx.shadowBlur    = 12;
        ctx.fillText(text, W/2, W/2);
        ctx.shadowBlur    = 0;
        ctx.textAlign     = 'left';
        ctx.textBaseline  = 'alphabetic';
    }
}
