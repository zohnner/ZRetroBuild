// === HIGH SCORE MANAGER (per-game) ===
class HighScoreManager {
    constructor() {
        this.MAX      = 5;
        this.defaults = {
            snake: [
                { initials:'ZRB', score:9900 }, { initials:'ACE', score:7400 },
                { initials:'MXR', score:5200 }, { initials:'NES', score:3100 },
                { initials:'C64', score:1500 },
            ],
            breakout: [
                { initials:'ACE', score:4800 }, { initials:'ZRB', score:3600 },
                { initials:'MXR', score:2400 }, { initials:'NES', score:1600 },
                { initials:'C64', score: 800 },
            ],
            invaders: [
                { initials:'INV', score:8800 }, { initials:'UFO', score:6600 },
                { initials:'ZRB', score:4400 }, { initials:'ACE', score:2200 },
                { initials:'C64', score:1100 },
            ],
        };
        this._cache = {};
    }

    _key(gameId) { return 'arcadeScores_' + gameId + '_v1'; }

    _load(gameId) {
        if (this._cache[gameId]) return this._cache[gameId];
        try {
            var raw = localStorage.getItem(this._key(gameId));
            if (!raw) throw new Error('no data');
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) throw new Error('bad shape');
            this._cache[gameId] = parsed;
            return parsed;
        } catch(e) {
            var def = (this.defaults[gameId] || []).map(function(e) { return { initials: e.initials, score: e.score }; });
            this._cache[gameId] = def;
            return def;
        }
    }

    _save(gameId) {
        try { localStorage.setItem(this._key(gameId), JSON.stringify(this._cache[gameId])); } catch(e) {}
    }

    isHighScore(score, gameId) {
        gameId = gameId || 'snake';
        if (score <= 0) return false;
        var s = this._load(gameId);
        if (s.length < this.MAX) return true;
        return score > s[s.length - 1].score;
    }

    add(initials, score, gameId) {
        gameId = gameId || 'snake';
        var cleaned = ((initials || 'AAA').toUpperCase().replace(/[^A-Z]/g, 'A') + 'AAA').slice(0, 3);
        var s = this._load(gameId);
        s.push({ initials: cleaned, score: score });
        s.sort(function(a, b) { return b.score - a.score; });
        this._cache[gameId] = s.slice(0, this.MAX);
        this._save(gameId);
    }

    getTop(gameId) { return this._load(gameId || 'snake'); }

    getTopScore(gameId) {
        var s = this._load(gameId || 'snake');
        return s.length ? s[0].score : 0;
    }

    getTopScoreFor(gameId) { return this.getTopScore(gameId); }

    renderList(listEl, gameId) {
        if (!listEl) return;
        gameId = gameId || 'snake';
        var top      = this.getTop(gameId);
        var maxScore = (top[0] && top[0].score) || 1;
        listEl.innerHTML = top.map(function(e, i) {
            return '<li>' +
                '<span class="score-rank">#' + (i+1) + '</span>' +
                '<span class="score-initials">' + e.initials + '</span>' +
                '<div class="score-bar" style="width:' + Math.round(e.score/maxScore*100) + '%"></div>' +
                '<span class="score-value">' + String(e.score).padStart(5,'0') + '</span>' +
                '</li>';
        }).join('');
    }
}

window.highScores = new HighScoreManager();
