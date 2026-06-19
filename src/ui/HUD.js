// HUD — the cockpit overlay: crosshair, shield/hull bars, score + combo, wave
// indicator, a 360° threat radar, and touch FIRE/BOOST buttons. Pure DOM/canvas,
// updated each frame from game state. Styles live in styles/main.css (.hud-*).
import * as THREE from 'three';

const RADAR_SIZE = 132;
const RADAR_RANGE = 130; // world units mapped to the radar edge

export class HUD {
  constructor({ onBoost, onFireDown, onFireUp } = {}) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-damage" data-damage></div>
      <div class="hud-top">
        <div class="hud-score"><span class="hud-score__val" data-score>0</span>
          <span class="hud-mult" data-mult>×1</span></div>
        <div class="hud-wave" data-wave>ВОЛНА 1</div>
        <div class="hud-best">РЕКОРД <span data-best>0</span></div>
      </div>
      <div class="hud-crosshair"><span></span><span></span><i></i></div>
      <div class="hud-banner" data-banner></div>
      <div class="hud-bottom">
        <div class="hud-bars">
          <div class="hud-bar hud-bar--shield"><label>ЩИТ</label>
            <div class="hud-bar__track"><div class="hud-bar__fill" data-shield></div></div></div>
          <div class="hud-bar hud-bar--hull"><label>КОРПУС</label>
            <div class="hud-bar__track"><div class="hud-bar__fill" data-hull></div></div></div>
        </div>
        <canvas class="hud-radar" width="${RADAR_SIZE}" height="${RADAR_SIZE}" data-radar></canvas>
      </div>
      <button class="hud-btn hud-btn--boost" data-boost>BOOST</button>
      <button class="hud-btn hud-btn--fire" data-fire>FIRE</button>
    `;

    this.el = {
      score: this.root.querySelector('[data-score]'),
      mult: this.root.querySelector('[data-mult]'),
      wave: this.root.querySelector('[data-wave]'),
      best: this.root.querySelector('[data-best]'),
      shield: this.root.querySelector('[data-shield]'),
      hull: this.root.querySelector('[data-hull]'),
      banner: this.root.querySelector('[data-banner]'),
      damage: this.root.querySelector('[data-damage]'),
      radar: this.root.querySelector('[data-radar]'),
      boost: this.root.querySelector('[data-boost]'),
      fire: this.root.querySelector('[data-fire]'),
    };
    this.ctx = this.el.radar.getContext('2d');

    // Buttons stop propagation so they don't also trigger tap-to-fire on the canvas.
    const stop = (e) => e.stopPropagation();
    this.el.boost.addEventListener('pointerdown', (e) => { stop(e); onBoost && onBoost(); });
    this.el.fire.addEventListener('pointerdown', (e) => { stop(e); onFireDown && onFireDown(); });
    this.el.fire.addEventListener('pointerup', (e) => { stop(e); onFireUp && onFireUp(); });
    this.el.fire.addEventListener('pointerleave', () => onFireUp && onFireUp());

    this._invQ = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._bannerTimer = 0;
  }

  mount() { document.body.appendChild(this.root); }
  setVisible(v) { this.root.style.display = v ? '' : 'none'; }

  showBanner(text, seconds = 2.2) {
    this.el.banner.textContent = text;
    this.el.banner.classList.add('is-show');
    this._bannerTimer = seconds;
  }

  flashDamage() {
    this.el.damage.classList.remove('is-flash');
    // force reflow so the animation can retrigger
    void this.el.damage.offsetWidth;
    this.el.damage.classList.add('is-flash');
  }

  update(dt, state) {
    const { player, score, wave, camera, enemies } = state;

    this.el.score.textContent = score.score.toLocaleString('ru-RU');
    this.el.mult.textContent = '×' + score.multiplier;
    this.el.mult.classList.toggle('is-hot', score.multiplier >= 3);
    this.el.best.textContent = Math.max(score.best, score.score).toLocaleString('ru-RU');
    this.el.wave.textContent = 'ВОЛНА ' + wave;

    this.el.shield.style.width = (100 * player.shield / player.maxShield) + '%';
    this.el.hull.style.width = (100 * player.hull / player.maxHull) + '%';

    if (this._bannerTimer > 0) {
      this._bannerTimer -= dt;
      if (this._bannerTimer <= 0) this.el.banner.classList.remove('is-show');
    }

    this._drawRadar(camera, enemies);
  }

  _drawRadar(camera, enemies) {
    const ctx = this.ctx;
    const c = RADAR_SIZE / 2;
    ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

    // backdrop + rings
    ctx.fillStyle = 'rgba(8,14,28,0.55)';
    ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(65,211,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, c - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, (c - 2) * 0.5, 0, Math.PI * 2); ctx.stroke();
    // player marker (center, pointing up = forward)
    ctx.fillStyle = '#41d3ff';
    ctx.beginPath(); ctx.moveTo(c, c - 5); ctx.lineTo(c - 4, c + 4); ctx.lineTo(c + 4, c + 4); ctx.closePath(); ctx.fill();

    this._invQ.copy(camera.quaternion).invert();
    for (const e of enemies) {
      if (!e.active) continue;
      // enemy position relative to the player, rotated into camera space
      this._v.copy(e.position).sub(camera.position).applyQuaternion(this._invQ);
      const dist = Math.hypot(this._v.x, this._v.z);
      const k = Math.min(1, dist / RADAR_RANGE) * (c - 4);
      const ang = Math.atan2(this._v.x, -this._v.z); // forward = up
      const px = c + Math.sin(ang) * k;
      const py = c - Math.cos(ang) * k;
      const behind = this._v.z > 0;
      ctx.fillStyle = e.type === 'boss' ? '#ff7849' : behind ? '#ff9fb0' : '#ff4d6d';
      ctx.beginPath();
      ctx.arc(px, py, e.type === 'boss' ? 4 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
