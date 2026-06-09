/* ═══════════════════════════════
   SNAKE GAME ENGINE
═══════════════════════════════ */
class SnakeGame {
    constructor(canvasEl) {
        this.canvas = canvasEl;
        this.ctx    = canvasEl.getContext('2d');

        // Grid config
        this.GRID  = 20;  // cells per axis
        this.CELL  = 1;   // pixels per cell — computed on resize

        // Game state
        this.state      = 'idle';  // idle | playing | paused | dead
        this.score      = 0;
        this.frameCount = 0;
        this.speed      = 8;  // frames between moves (lower = faster)

        this.snake    = [];
        this.dir      = { x: 1, y: 0 };
        this.nextDir  = { x: 1, y: 0 };
        this.food     = null;
        this.particles = [];

        this.raf       = null;
        this.lastTime  = 0;

        // Callbacks — set by GameController
        this.onScore  = null;  // (score) => void
        this.onDeath  = null;  // (score) => void

        this._keyHandler   = this._onKey.bind(this);
        this._touchStart   = null;
        this._touchStartXY = [0, 0];

        this._bindInput();
        this.resize();
    }

    // ─── Public API ──────────────────────────────────────────
    start() {
        const mid = Math.floor(this.GRID / 2);
        this.snake    = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
        this.dir      = { x: 1, y: 0 };
        this.nextDir  = { x: 1, y: 0 };
        this.score    = 0;
        this.frameCount = 0;
        this.speed    = 8;
        this.particles = [];
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
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;
        const size     = Math.min(wrapper.clientWidth, wrapper.clientHeight);
        this.CELL      = Math.max(1, Math.floor(size / this.GRID));
        const realSize = this.CELL * this.GRID;
        this.canvas.width  = realSize;
        this.canvas.height = realSize;
        this._draw();
    }

    destroy() {
        cancelAnimationFrame(this.raf);
        document.removeEventListener('keydown', this._keyHandler);
        this.canvas.removeEventListener('touchstart', this._touchStart);
        this.canvas.removeEventListener('touchend',   this._touchEnd);
    }

    // ─── Input ───────────────────────────────────────────────
    _bindInput() {
        document.addEventListener('keydown', this._keyHandler);

        // Touch swipe
        this._touchStart = e => {
            this._touchStartXY = [e.touches[0].clientX, e.touches[0].clientY];
        };
        this._touchEnd = e => {
            const [sx, sy] = this._touchStartXY;
            const dx = e.changedTouches[0].clientX - sx;
            const dy = e.changedTouches[0].clientY - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
            if (Math.abs(dx) > Math.abs(dy)) {
                this._tryDir(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
            } else {
                this._tryDir(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
            }
        };
        this.canvas.addEventListener('touchstart', this._touchStart, { passive: true });
        this.canvas.addEventListener('touchend',   this._touchEnd,   { passive: true });
    }

    _onKey(e) {
        const map = {
            ArrowUp:    { x: 0, y: -1 },
            ArrowDown:  { x: 0, y:  1 },
            ArrowLeft:  { x: -1, y: 0 },
            ArrowRight: { x:  1, y: 0 },
            w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
            s: { x: 0, y:  1 }, S: { x: 0, y:  1 },
            a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
            d: { x:  1, y: 0 }, D: { x:  1, y: 0 },
        };
        if (e.key === 'p' || e.key === 'P') { this.togglePause(); return; }
        const d = map[e.key];
        if (d) { e.preventDefault(); this._tryDir(d); }
    }

    _tryDir(d) {
        // Forbid 180-degree reversal
        if (d.x === -this.dir.x && d.y === -this.dir.y) return;
        this.nextDir = d;
    }

    // ─── Game loop ───────────────────────────────────────────
    _loop(timestamp) {
        if (this.state !== 'playing') return;

        if (!this.lastTime) this.lastTime = timestamp;
        const delta = timestamp - this.lastTime;

        // Aim for ~60 fps ticks, move snake every `speed` ticks
        if (delta >= 1000 / 60) {
            this.lastTime = timestamp;
            this.frameCount++;

            if (this.frameCount % this.speed === 0) {
                this._update();
            }
            if (this.state === 'playing') {
                this._updateParticles();
                this._draw();
            }
        }

        if (this.state === 'playing') {
            this.raf = requestAnimationFrame(t => this._loop(t));
        }
    }

    // ─── Update ──────────────────────────────────────────────
    _update() {
        this.dir = { ...this.nextDir };
        const head    = this.snake[0];
        const newHead = { x: head.x + this.dir.x, y: head.y + this.dir.y };

        // Wall collision
        if (newHead.x < 0 || newHead.x >= this.GRID ||
            newHead.y < 0 || newHead.y >= this.GRID) {
            this._die(); return;
        }

        // Self collision
        for (const seg of this.snake) {
            if (seg.x === newHead.x && seg.y === newHead.y) {
                this._die(); return;
            }
        }

        this.snake.unshift(newHead);

        // Eat food
        if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += 10;
            this._spawnEatParticles(newHead);
            this._placeFood();

            // Gradually increase speed (cap at 3)
            if (this.score % 50 === 0 && this.speed > 3) this.speed--;

            if (this.onScore) this.onScore(this.score);
            if (window.audio) window.audio.eat();
        } else {
            this.snake.pop();
        }
    }

    _die() {
        this.state = 'dead';
        cancelAnimationFrame(this.raf);
        this._spawnDeathParticles();
        // Brief particle animation before notifying
        let ticks = 0;
        const burst = () => {
            this._updateParticles();
            this._draw();
            if (++ticks < 30 && this.particles.length) {
                requestAnimationFrame(burst);
            } else {
                if (this.onDeath) this.onDeath(this.score);
            }
        };
        requestAnimationFrame(burst);
        if (window.audio) window.audio.die();
    }

    // ─── Food ────────────────────────────────────────────────
    _placeFood() {
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * this.GRID),
                y: Math.floor(Math.random() * this.GRID),
            };
        } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
        this.food = pos;
    }

    // ─── Particles ───────────────────────────────────────────
    _spawnEatParticles(pos) {
        const cx = pos.x * this.CELL + this.CELL / 2;
        const cy = pos.y * this.CELL + this.CELL / 2;
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const spd   = 1.5 + Math.random() * 2.5;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: 1, decay: 0.07, size: 3,
                color: '#ff00ff',
            });
        }
    }

    _spawnDeathParticles() {
        for (const seg of this.snake) {
            const cx = seg.x * this.CELL + this.CELL / 2;
            const cy = seg.y * this.CELL + this.CELL / 2;
            for (let i = 0; i < 5; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd   = 1 + Math.random() * 3.5;
                this.particles.push({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd - 0.5,
                    life: 1, decay: 0.028 + Math.random() * 0.03,
                    size: 2 + Math.random() * 2.5,
                    color: '#00ff41',
                });
            }
        }
    }

    _updateParticles() {
        this.particles = this.particles.filter(p => p.life > 0);
        for (const p of this.particles) {
            p.x  += p.vx;
            p.y  += p.vy;
            p.vy += 0.12; // gravity
            p.life -= p.decay;
        }
    }

    // ─── Drawing ─────────────────────────────────────────────
    _draw() {
        const ctx = this.ctx;
        const C   = this.CELL;
        const G   = this.GRID;
        const W   = C * G;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, W);

        // Grid lines
        ctx.strokeStyle = 'rgba(0,255,65,0.05)';
        ctx.lineWidth   = 0.5;
        for (let i = 0; i <= G; i++) {
            ctx.beginPath(); ctx.moveTo(i * C, 0); ctx.lineTo(i * C, W); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * C); ctx.lineTo(W, i * C); ctx.stroke();
        }

        // Food — pulsing magenta square
        if (this.food) {
            const pulse = 0.65 + 0.35 * Math.sin(this.frameCount * 0.22);
            const pad   = 2;
            ctx.shadowBlur  = 14 * pulse;
            ctx.shadowColor = '#ff00ff';
            ctx.fillStyle   = `rgba(255,0,255,${0.75 + 0.25 * pulse})`;
            ctx.fillRect(this.food.x * C + pad, this.food.y * C + pad, C - pad * 2, C - pad * 2);

            // Inner bright dot
            ctx.fillStyle = '#fff';
            const d = Math.max(2, C * 0.2);
            ctx.fillRect(
                this.food.x * C + C / 2 - d / 2,
                this.food.y * C + C / 2 - d / 2,
                d, d
            );
            ctx.shadowBlur = 0;
        }

        // Snake
        this.snake.forEach((seg, i) => {
            const isHead = (i === 0);
            const t      = i / this.snake.length;  // 0 (head) → 1 (tail)

            // Color: head=cyan, body=bright→dim green
            if (isHead) {
                ctx.fillStyle  = '#00ffff';
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur  = 10;
            } else {
                const g = Math.round(255 - t * 130);
                const b = Math.round(65  + t * 40);
                ctx.fillStyle  = `rgb(0,${g},${b})`;
                ctx.shadowColor = '#00ff41';
                ctx.shadowBlur  = 3;
            }

            const pad = isHead ? 1 : 2;
            ctx.fillRect(seg.x * C + pad, seg.y * C + pad, C - pad * 2, C - pad * 2);

            // Head eyes
            if (isHead) {
                ctx.shadowBlur = 0;
                ctx.fillStyle  = '#000510';
                const eyeSize = Math.max(2, Math.floor(C * 0.18));
                const [e1, e2] = this._eyePositions(seg, C);
                ctx.fillRect(e1.x, e1.y, eyeSize, eyeSize);
                ctx.fillRect(e2.x, e2.y, eyeSize, eyeSize);
            }
        });
        ctx.shadowBlur = 0;

        // Particles
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle   = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        // Idle / pause overlay
        if (this.state === 'idle')   this._drawCentreText('READY', 'rgba(0,255,255,0.2)');
        if (this.state === 'paused') this._drawPauseOverlay();
    }

    _eyePositions(seg, C) {
        const d   = this.dir;
        const es  = Math.max(2, Math.floor(C * 0.18));
        const off = Math.floor(C * 0.2);
        let ax, ay, bx, by;

        if (d.x !== 0) {
            // Moving horizontally
            ax = seg.x * C + (d.x > 0 ? C - off - es : off);
            ay = seg.y * C + off;
            bx = ax;
            by = seg.y * C + C - off - es;
        } else {
            // Moving vertically
            ax = seg.x * C + off;
            ay = seg.y * C + (d.y > 0 ? C - off - es : off);
            bx = seg.x * C + C - off - es;
            by = ay;
        }
        return [{ x: ax, y: ay }, { x: bx, y: by }];
    }

    _drawPauseOverlay() {
        const ctx = this.ctx;
        const W   = this.CELL * this.GRID;
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.fillRect(0, 0, W, W);
        this._drawCentreText('PAUSED', 'rgba(0,255,255,0.9)');
    }

    _drawCentreText(text, color) {
        const ctx  = this.ctx;
        const W    = this.CELL * this.GRID;
        const size = Math.max(8, Math.floor(this.CELL * 0.75));
        ctx.font          = `${size}px 'Press Start 2P', monospace`;
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.fillStyle     = color;
        ctx.shadowColor   = color;
        ctx.shadowBlur    = 12;
        ctx.fillText(text, W / 2, W / 2);
        ctx.shadowBlur    = 0;
        ctx.textAlign     = 'left';
        ctx.textBaseline  = 'alphabetic';
    }
}
