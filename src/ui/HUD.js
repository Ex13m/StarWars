// HUD — combat overlay: crosshair, target-lock markers, speed/boost readout,
// shield/hull bars, score + combo, wave + boss bars, 360° threat radar, banners,
// damage/warp flashes and a low-hull alarm. Steering/throttle/fire live in
// ui/Controls.js. Pure DOM/canvas, refreshed each frame from game state.
import * as THREE from 'three';

const RADAR_SIZE = 132;
const RADAR_RANGE = 130;
const MARKERS = 16;
const LOCK_RADIUS = 80; // px from screen center to count as the locked target

export class HUD {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-damage" data-damage></div>
      <div class="hud-incoming" data-incoming></div>
      <div class="hud-warp" data-warp></div>
      <div class="hud-markers" data-markers></div>
      <div class="hud-top">
        <div class="hud-score"><span data-score>0</span><span class="hud-mult" data-mult>×1</span></div>
        <div class="hud-wave" data-wave>ВОЛНА 1</div>
        <div class="hud-best">РЕКОРД <span data-best>0</span></div>
      </div>
      <div class="hud-boss" data-boss-wrap hidden>
        <label data-boss-name>ХОР</label>
        <div class="hud-bossbar"><div class="hud-bossbar__fill" data-boss-fill></div></div>
      </div>
      <div class="hud-crosshair" data-crosshair><span></span><span></span><i></i></div>
      <div class="hud-banner" data-banner></div>
      <div class="hud-speed">
        <span class="hud-speed__val" data-speed>0</span><span class="hud-speed__unit">М/С</span>
        <span class="hud-boost" data-boostbadge>БУСТ</span>
      </div>
      <div class="hud-bottom">
        <div class="hud-bars">
          <div class="hud-bar hud-bar--shield"><label>ЩИТ</label>
            <div class="hud-bar__track"><div class="hud-bar__fill" data-shield></div></div></div>
          <div class="hud-bar hud-bar--hull"><label>КОРПУС</label>
            <div class="hud-bar__track"><div class="hud-bar__fill" data-hull></div></div></div>
        </div>
        <canvas class="hud-radar" width="${RADAR_SIZE}" height="${RADAR_SIZE}" data-radar></canvas>
      </div>
    `;

    this.el = {
      score: q(this.root, '[data-score]'),
      mult: q(this.root, '[data-mult]'),
      wave: q(this.root, '[data-wave]'),
      best: q(this.root, '[data-best]'),
      shield: q(this.root, '[data-shield]'),
      hull: q(this.root, '[data-hull]'),
      banner: q(this.root, '[data-banner]'),
      damage: q(this.root, '[data-damage]'),
      incoming: q(this.root, '[data-incoming]'),
      warp: q(this.root, '[data-warp]'),
      radar: q(this.root, '[data-radar]'),
      crosshair: q(this.root, '[data-crosshair]'),
      bossWrap: q(this.root, '[data-boss-wrap]'),
      bossName: q(this.root, '[data-boss-name]'),
      bossFill: q(this.root, '[data-boss-fill]'),
      speed: q(this.root, '[data-speed]'),
      boostBadge: q(this.root, '[data-boostbadge]'),
      markers: q(this.root, '[data-markers]'),
    };
    this.ctx = this.el.radar.getContext('2d');

    // Pool of reusable target-marker elements (on-screen bracket OR edge arrow).
    this.markerPool = [];
    for (let i = 0; i < MARKERS; i++) {
      const m = document.createElement('div');
      m.className = 'hud-marker';
      m.innerHTML = `<div class="hud-marker__box"></div><div class="hud-marker__arrow"></div><div class="hud-marker__label"></div>`;
      m.style.display = 'none';
      this.el.markers.appendChild(m);
      this.markerPool.push({
        el: m,
        arrow: m.querySelector('.hud-marker__arrow'),
        label: m.querySelector('.hud-marker__label'),
      });
    }

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

  flashDamage() { retrigger(this.el.damage, 'is-flash'); }
  flashWarp() { retrigger(this.el.warp, 'is-flash'); }

  /** Red arc pointing toward incoming fire. angle: 0 = top, +PI/2 = right. */
  showIncoming(angle) {
    this.el.incoming.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    retrigger(this.el.incoming, 'is-flash');
  }

  update(dt, state) {
    const { player, score, wave, camera, enemies, boss, speed, throttleT } = state;

    this.el.score.textContent = score.score.toLocaleString('ru-RU');
    this.el.mult.textContent = '×' + score.multiplier;
    this.el.mult.classList.toggle('is-hot', score.multiplier >= 3);
    this.el.best.textContent = Math.max(score.best, score.score).toLocaleString('ru-RU');
    this.el.wave.textContent = 'ВОЛНА ' + wave;

    this.el.shield.style.width = (100 * player.shield / player.maxShield) + '%';
    this.el.hull.style.width = (100 * player.hull / player.maxHull) + '%';
    this.root.classList.toggle('is-critical', player.hull / player.maxHull <= 0.3);

    this.el.speed.textContent = Math.round(speed);
    this.el.boostBadge.classList.toggle('is-on', throttleT > 0.8);

    if (boss && boss.active) {
      this.el.bossWrap.hidden = false;
      this.el.bossName.textContent = 'ХОР · ФАЗА ' + boss.bossPhase();
      this.el.bossFill.style.width = (100 * Math.max(0, boss.hp) / boss.maxHp) + '%';
    } else {
      this.el.bossWrap.hidden = true;
    }

    if (this._bannerTimer > 0) {
      this._bannerTimer -= dt;
      if (this._bannerTimer <= 0) this.el.banner.classList.remove('is-show');
    }

    this._updateMarkers(camera, enemies);
    this._drawRadar(camera, enemies);
  }

  // Project every enemy: on-screen ones get a target bracket, off-screen/behind
  // ones get an edge ARROW pointing where to turn. The on-screen enemy nearest
  // the crosshair is flagged as the lock.
  _updateMarkers(camera, enemies) {
    const w = window.innerWidth, h = window.innerHeight;
    const cx = w / 2, cy = h / 2;
    const margin = 46;
    let lockIdx = -1, lockBest = LOCK_RADIUS;

    const data = [];
    for (const e of enemies) {
      if (!e.active || data.length >= MARKERS) continue;
      this._v.copy(e.position).project(camera);
      let nx = this._v.x, ny = this._v.y;
      const behind = this._v.z > 1;
      if (behind) { nx = -nx; ny = -ny; } // flip so the arrow points the right way
      const dist = Math.round(e.position.distanceTo(camera.position));
      const boss = e.type === 'boss';
      const idx = data.length;

      if (!behind && Math.abs(nx) <= 1 && Math.abs(ny) <= 1) {
        const x = (nx * 0.5 + 0.5) * w;
        const y = (-ny * 0.5 + 0.5) * h;
        if (Math.hypot(x - cx, y - cy) < lockBest) { lockBest = Math.hypot(x - cx, y - cy); lockIdx = idx; }
        data.push({ edge: false, x, y, dist, boss });
      } else {
        // clamp the direction onto a screen-edge box → arrow position + heading
        let ax = nx, ay = ny;
        const m = Math.max(Math.abs(ax), Math.abs(ay)) || 1;
        ax /= m; ay /= m;
        const x = (ax * 0.5 + 0.5) * (w - 2 * margin) + margin;
        const y = (-ay * 0.5 + 0.5) * (h - 2 * margin) + margin;
        data.push({ edge: true, x, y, dist, boss, angle: Math.atan2(ax, ay) });
      }
    }

    for (let i = 0; i < MARKERS; i++) {
      const m = this.markerPool[i];
      const s = data[i];
      if (!s) { m.el.style.display = 'none'; continue; }
      m.el.style.display = '';
      m.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      m.el.classList.toggle('is-edge', s.edge);
      m.el.classList.toggle('is-boss', s.boss);
      m.el.classList.toggle('is-lock', !s.edge && i === lockIdx);
      if (s.edge) m.arrow.style.transform = `translate(-50%, -50%) rotate(${s.angle}rad)`;
      m.label.textContent = (!s.edge && i === lockIdx ? 'ЦЕЛЬ · ' : '') + s.dist + 'м';
    }

    this.el.crosshair.classList.toggle('is-lock', lockIdx >= 0);
  }

  _drawRadar(camera, enemies) {
    const ctx = this.ctx;
    const c = RADAR_SIZE / 2;
    ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);
    ctx.fillStyle = 'rgba(8,14,28,0.55)';
    ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(65,211,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, c - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, (c - 2) * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#41d3ff';
    ctx.beginPath(); ctx.moveTo(c, c - 5); ctx.lineTo(c - 4, c + 4); ctx.lineTo(c + 4, c + 4); ctx.closePath(); ctx.fill();

    this._invQ.copy(camera.quaternion).invert();
    for (const e of enemies) {
      if (!e.active) continue;
      this._v.copy(e.position).sub(camera.position).applyQuaternion(this._invQ);
      const dist = Math.hypot(this._v.x, this._v.z);
      const k = Math.min(1, dist / RADAR_RANGE) * (c - 4);
      const ang = Math.atan2(this._v.x, -this._v.z);
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

function q(root, sel) { return root.querySelector(sel); }
function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add(cls);
}
