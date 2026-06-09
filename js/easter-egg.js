// === KONAMI CODE EASTER EGG ===
// Sequence: Up Up Down Down Left Right Left Right B A
class KonamiCode {
    constructor() {
        this.sequence = [
            'ArrowUp','ArrowUp','ArrowDown','ArrowDown',
            'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight',
            'KeyB','KeyA'
        ];
        this.pos       = 0;
        this.activated = false;
        var self = this;
        document.addEventListener('keydown', function(e) { self._check(e.code); });
    }

    _check(code) {
        if (this.activated) return;
        if (code === this.sequence[this.pos]) {
            this.pos++;
            if (this.pos === this.sequence.length) this._activate();
        } else {
            this.pos = (code === this.sequence[0]) ? 1 : 0;
        }
    }

    _activate() {
        this.activated = true;
        if (window.game) window.game.addCredits(30);

        var toast = document.getElementById('konamiToast');
        if (toast) {
            toast.classList.remove('hidden');
            setTimeout(function() { toast.classList.add('hidden'); }, 3200);
        }

        this._rainbow();
        if (window.audio) { window.audio.init(); window.audio.konami(); }

        var self = this;
        setTimeout(function() { self.activated = false; self.pos = 0; }, 5000);
    }

    _rainbow() {
        var panel = document.getElementById('screenPanel');
        if (!panel) return;
        var colors = ['#ff00ff','#00ffff','#ffff00','#00ff41','#ff7700'];
        var i = 0;
        var iv = setInterval(function() {
            var c = colors[i % colors.length];
            panel.style.borderColor = c;
            panel.style.boxShadow = '-10px 0 30px ' + c + '55, 10px 0 30px ' + c + '55';
            i++;
            if (i > 32) {
                clearInterval(iv);
                panel.style.borderColor = '';
                panel.style.boxShadow   = '';
            }
        }, 90);
    }
}

new KonamiCode();
