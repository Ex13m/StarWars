// Screens — full-screen end states: Game Over and Victory. Minimal DOM overlays
// with a retry callback. Wave/briefing banners are handled inline by the HUD.
export class Screens {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'screen';
    this.root.style.display = 'none';
    this.root.innerHTML = `
      <div class="screen__panel">
        <p class="screen__eyebrow" data-eyebrow></p>
        <h2 class="screen__title" data-title></h2>
        <div class="screen__stats">
          <div><span data-score>0</span><label>СЧЁТ</label></div>
          <div><span data-best>0</span><label>РЕКОРД</label></div>
          <div><span data-wave>0</span><label>ВОЛНА</label></div>
        </div>
        <p class="screen__flavor" data-flavor></p>
        <button class="btn btn--primary" data-retry>СНОВА В БОЙ</button>
      </div>`;

    this.el = {
      eyebrow: this.root.querySelector('[data-eyebrow]'),
      title: this.root.querySelector('[data-title]'),
      score: this.root.querySelector('[data-score]'),
      best: this.root.querySelector('[data-best]'),
      wave: this.root.querySelector('[data-wave]'),
      flavor: this.root.querySelector('[data-flavor]'),
      retry: this.root.querySelector('[data-retry]'),
    };
    this.el.retry.addEventListener('click', () => this._onRetry && this._onRetry());
  }

  mount() { document.body.appendChild(this.root); }

  show({ victory, score, best, wave, newBest, onRetry }) {
    this._onRetry = onRetry;
    this.el.eyebrow.textContent = victory ? 'СЕКТОР УДЕРЖАН' : 'СВЯЗЬ ПОТЕРЯНА';
    this.el.title.textContent = victory ? 'ПОБЕДА' : 'ПИЛОТ ПАЛ';
    this.el.score.textContent = score.toLocaleString('ru-RU');
    this.el.best.textContent = best.toLocaleString('ru-RU');
    this.el.wave.textContent = wave;
    this.el.flavor.textContent = newBest
      ? 'Новый рекорд! Эскадрилья «Вэнгард» запомнит этот вылет.'
      : victory
        ? 'Последний транспорт ушёл за врата. Ты выиграл им время.'
        : 'Корпус разрушен. Но каждая удержанная минута спасла жизни.';
    this.root.classList.toggle('screen--victory', !!victory);
    this.root.style.display = '';
  }

  hide() { this.root.style.display = 'none'; }
}
