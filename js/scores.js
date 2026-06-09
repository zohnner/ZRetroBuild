/* ═══════════════════════════════
   HIGH SCORE MANAGER
═══════════════════════════════ */
class HighScoreManager {
    constructor() {
        this.KEY      = 'arcadeHighScores_v2';
        this.MAX      = 5;
        this.defaults = [
            { initials: 'ZRB', score: 9900 },
            { initials: 'ACE', score: 7400 },
            { initials: 'MXR', score: 5200 },
            { initials: 'NES', score: 3100 },
            { initials: 'C64', score: 1500 },
        ];
        this.scores = this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return this.defaults.map(e => ({ ...e }));
            const parsed = JSON.parse(raw);
            // Validate shape
            if (!Array.isArray(parsed) || !parsed.every(e => e.initials && typeof e.score === 'number')) {
                return this.defaults.map(e => ({ ...e }));
            }
            return parsed;
        } catch {
            return this.defaults.map(e => ({ ...e }));
        }
    }

    _save() {
        try { localStorage.setItem(this.KEY, JSON.stringify(this.scores)); } catch {}
    }

    /** True if `score` would make the board */
    isHighScore(score) {
        if (score <= 0) return false;
        if (this.scores.length < this.MAX) return true;
        return score > this.scores[this.scores.length - 1].score;
    }

    /** Add entry, sort, trim, persist */
    add(initials, score) {
        const cleaned = (initials || 'AAA')
            .toUpperCase()
            .replace(/[^A-Z]/g, 'A')
            .padEnd(3, 'A')
            .slice(0, 3);
        this.scores.push({ initials: cleaned, score });
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, this.MAX);
        this._save();
    }

    getTop()      { return this.scores; }
    getTopScore() { return this.scores.length ? this.scores[0].score : 0; }

    /** Render into an <ol> element */
    renderList(listEl) {
        if (!listEl) return;
        const top      = this.getTop();
        const maxScore = top[0]?.score || 1;

        listEl.innerHTML = top.map((e, i) => `
            <li>
                <span class="score-rank">#${i + 1}</span>
                <span class="score-initials">${e.initials}</span>
                <div  class="score-bar" style="width:${Math.round(e.score / maxScore * 100)}%"></div>
                <span class="score-value">${String(e.score).padStart(5, '0')}</span>
            </li>
        `).join('');
    }
}

window.highScores = new HighScoreManager();
