// === ACHIEVEMENT SYSTEM ===
var ACHIEVEMENTS = [
    { id:'first_blood',  title:'FIRST BLOOD',   desc:'Score your first point',        icon:'*',  game:null     },
    { id:'century',      title:'CENTURY',        desc:'Score 100+ in any game',        icon:'C',  game:null     },
    { id:'high_roller',  title:'HIGH ROLLER',    desc:'Score 1000+ in any game',       icon:'$',  game:null     },
    { id:'snake_charmer',title:'SNAKE CHARMER',  desc:'Reach level 3 in Snake',        icon:'S',  game:'snake'  },
    { id:'coiled',       title:'COILED',         desc:'Grow to 15 segments',           icon:'~',  game:'snake'  },
    { id:'speed_demon',  title:'SPEED DEMON',    desc:'Collect the SLOW power-up',     icon:'!',  game:'snake'  },
    { id:'brick_buster', title:'BRICK BUSTER',   desc:'Clear a full Breakout level',   icon:'B',  game:'breakout'},
    { id:'multiball',    title:'MULTIBALL',      desc:'Catch MULTI power-up',          icon:'M',  game:'breakout'},
    { id:'chain',        title:'CHAIN REACTION', desc:'Trigger an explosive brick',    icon:'X',  game:'breakout'},
    { id:'invader',      title:'FIRST CONTACT',  desc:'Kill your first alien',         icon:'A',  game:'invaders'},
    { id:'ufo_hunter',   title:'UFO HUNTER',     desc:'Destroy the mystery ship',      icon:'U',  game:'invaders'},
    { id:'wave_rider',   title:'WAVE RIDER',     desc:'Reach wave 3 in Invaders',      icon:'W',  game:'invaders'},
    { id:'konami',       title:'KONAMI MASTER',  desc:'Enter the Konami Code',         icon:'K',  game:null     },
    { id:'coin_op',      title:'COIN OP',        desc:'Insert 10 coins',               icon:'o',  game:null     },
    { id:'hat_trick',    title:'HAT TRICK',      desc:'Play all 3 games in one session',icon:'H', game:null     },
];

class AchievementManager {
    constructor() {
        this.KEY      = 'arcadeAchievements_v1';
        this.unlocked = this._load();
        this._queue   = [];
        this._showing = false;
        this._gamesPlayedThisSession = new Set();
    }

    _load() {
        try {
            var raw = localStorage.getItem(this.KEY);
            return raw ? JSON.parse(raw) : {};
        } catch(e) { return {}; }
    }

    _save() {
        try { localStorage.setItem(this.KEY, JSON.stringify(this.unlocked)); } catch(e) {}
    }

    unlock(id) {
        if (this.unlocked[id]) return;
        this.unlocked[id] = Date.now();
        this._save();
        var def = ACHIEVEMENTS.find(a => a.id === id);
        if (def) this._queue.push(def);
        this._flush();
    }

    check(event, data) {
        data = data || {};
        switch(event) {
            case 'score':
                if (data.score >= 1)    this.unlock('first_blood');
                if (data.score >= 100)  this.unlock('century');
                if (data.score >= 1000) this.unlock('high_roller');
                break;
            case 'snake_level':
                if (data.level >= 3) this.unlock('snake_charmer');
                break;
            case 'snake_length':
                if (data.length >= 15) this.unlock('coiled');
                break;
            case 'snake_powerup':
                if (data.type === 'slow') this.unlock('speed_demon');
                break;
            case 'breakout_levelclear':
                this.unlock('brick_buster');
                break;
            case 'breakout_powerup':
                if (data.type === 'multi') this.unlock('multiball');
                break;
            case 'breakout_explosive':
                this.unlock('chain');
                break;
            case 'invaders_kill':
                this.unlock('invader');
                break;
            case 'invaders_ufo':
                this.unlock('ufo_hunter');
                break;
            case 'invaders_wave':
                if (data.wave >= 3) this.unlock('wave_rider');
                break;
            case 'konami':
                this.unlock('konami');
                break;
            case 'coin':
                var coins = (parseInt(localStorage.getItem('arcadeTotalCoins')||'0',10) || 0) + 1;
                localStorage.setItem('arcadeTotalCoins', coins);
                if (coins >= 10) this.unlock('coin_op');
                break;
            case 'game_start':
                this._gamesPlayedThisSession.add(data.game);
                if (this._gamesPlayedThisSession.size >= 3) this.unlock('hat_trick');
                break;
        }
    }

    getAll() { return ACHIEVEMENTS; }
    isUnlocked(id) { return !!this.unlocked[id]; }
    unlockedCount() { return Object.keys(this.unlocked).length; }

    _flush() {
        if (this._showing || !this._queue.length) return;
        this._showing = true;
        var def  = this._queue.shift();
        var self = this;
        this._showToast(def, function() {
            self._showing = false;
            self._flush();
        });
    }

    _showToast(def, onDone) {
        var el = document.getElementById('achievementToast');
        if (!el) { onDone(); return; }
        el.querySelector('.ach-icon').textContent  = def.icon;
        el.querySelector('.ach-title').textContent = def.title;
        el.querySelector('.ach-desc').textContent  = def.desc;
        el.classList.remove('hidden', 'toast-out');
        el.classList.add('toast-in');
        if (window.audio) { window.audio.init(); window.audio.start(); }
        var self = this;
        setTimeout(function() {
            el.classList.remove('toast-in');
            el.classList.add('toast-out');
            setTimeout(function() {
                el.classList.add('hidden');
                el.classList.remove('toast-out');
                onDone();
            }, 500);
        }, 3000);
    }

    renderGallery(containerEl) {
        if (!containerEl) return;
        containerEl.innerHTML = ACHIEVEMENTS.map(a => {
            var done = this.isUnlocked(a.id);
            return '<div class="ach-badge' + (done ? ' ach-badge--done' : '') + '" title="' + a.desc + '">' +
                     '<span class="ach-badge-icon">' + a.icon + '</span>' +
                     '<span class="ach-badge-label">' + a.title + '</span>' +
                   '</div>';
        }).join('');
    }
}

window.achievements = new AchievementManager();
