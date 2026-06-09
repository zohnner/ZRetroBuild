// === GAME SELECT SCREEN ===
class GameSelect {
    constructor(games, onSelect) {
        this.games    = games;      // [{ id, title, tag, color }]
        this.idx      = 0;
        this.onSelect = onSelect;
        this._kd      = this._onKey.bind(this);
    }

    show(containerEl) {
        this.el = containerEl;
        this.el.innerHTML = this._render();
        this.el.classList.remove('hidden');
        document.addEventListener('keydown', this._kd);
        this._refresh();
        this._bindClicks();
    }

    hide() {
        if (this.el) this.el.classList.add('hidden');
        document.removeEventListener('keydown', this._kd);
    }

    _render() {
        var cards = this.games.map(function(g, i) {
            return '<div class="game-card" data-idx="' + i + '" data-game="' + g.id + '">' +
                     '<div class="game-card__preview" style="border-color:' + g.color + ';box-shadow:0 0 18px ' + g.color + '44">' +
                       '<div class="game-card__art" data-art="' + g.id + '"></div>' +
                     '</div>' +
                     '<div class="game-card__title" style="color:' + g.color + '">' + g.title + '</div>' +
                     '<div class="game-card__tag">' + g.tag + '</div>' +
                     '<div class="game-card__hi"><span class="gc-hi-label">HI</span> <span class="gc-hi-val" data-hival="' + g.id + '">00000</span></div>' +
                   '</div>';
        }).join('');
        return '<div class="select-inner">' +
                 '<div class="select-header">SELECT GAME</div>' +
                 '<div class="select-grid">' + cards + '</div>' +
                 '<div class="select-footer">ARROWS / CLICK &nbsp;&middot;&nbsp; ENTER TO PLAY</div>' +
               '</div>';
    }

    _refresh() {
        if (!this.el) return;
        var cards = this.el.querySelectorAll('.game-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('game-card--active', i === this.idx);
        }
        // Update hi-scores
        var self = this;
        this.games.forEach(function(g) {
            var el = self.el.querySelector('[data-hival="' + g.id + '"]');
            if (el) {
                var hs = window.highScores ? window.highScores.getTopScoreFor(g.id) : 0;
                el.textContent = String(hs).padStart(5, '0');
            }
        });
    }

    _bindClicks() {
        var self = this;
        var cards = this.el.querySelectorAll('.game-card');
        cards.forEach(function(card, i) {
            card.addEventListener('click', function() {
                self.idx = i;
                self._refresh();
                setTimeout(function() { self._confirm(); }, 120);
            });
        });
    }

    _onKey(e) {
        if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            this.idx = (this.idx - 1 + this.games.length) % this.games.length;
            this._refresh();
            if (window.audio) { window.audio.init(); window.audio.select(); }
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            this.idx = (this.idx + 1) % this.games.length;
            this._refresh();
            if (window.audio) { window.audio.init(); window.audio.select(); }
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._confirm();
        }
    }

    _confirm() {
        if (window.audio) { window.audio.init(); window.audio.start(); }
        var chosen = this.games[this.idx];
        this.hide();
        if (this.onSelect) this.onSelect(chosen.id);
    }
}
