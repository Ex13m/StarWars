// Controls — on-screen touch controls (works with mouse too):
//   - left virtual JOYSTICK: steer/aim (steerX, steerY in -1..1)
//   - right THROTTLE slider: speed 0..1 (top = warp boost)
//   - FIRE button: hold to shoot (firing)
//
// Multi-touch aware: each control tracks its own pointerId so you can steer,
// throttle and fire at the same time. Game reads the public fields each frame.
export class Controls {
  constructor() {
    this.steerX = 0;
    this.steerY = 0;
    this.throttle = 0.45;   // start at a gentle cruise
    this.firing = false;

    this.root = document.createElement('div');
    this.root.className = 'controls';
    this.root.innerHTML = `
      <div class="joy" data-joy>
        <div class="joy__ring"></div>
        <div class="joy__knob" data-knob></div>
      </div>
      <div class="throttle" data-throttle>
        <div class="throttle__track">
          <div class="throttle__fill" data-tfill></div>
          <div class="throttle__boost">БУСТ</div>
        </div>
        <div class="throttle__knob" data-tknob></div>
        <span class="throttle__label">ТЯГА</span>
      </div>
      <button class="fire-btn" data-fire><span>FIRE</span></button>
    `;

    this.joy = this.root.querySelector('[data-joy]');
    this.knob = this.root.querySelector('[data-knob]');
    this.throttleEl = this.root.querySelector('[data-throttle]');
    this.tfill = this.root.querySelector('[data-tfill]');
    this.tknob = this.root.querySelector('[data-tknob]');
    this.fireBtn = this.root.querySelector('[data-fire]');

    this._joyId = null;
    this._thrId = null;
    this._fireId = null;

    this._bind();
  }

  mount() {
    document.body.appendChild(this.root);
    this._layoutThrottle();
  }
  setVisible(v) { this.root.style.display = v ? '' : 'none'; }

  get boosting() { return this.throttle > 0.8; }

  _bind() {
    this.joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._joyId = e.pointerId;
      this._updateJoy(e);
    });
    this.throttleEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._thrId = e.pointerId;
      this._updateThrottle(e);
    });
    this.fireBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._fireId = e.pointerId;
      this.firing = true;
      this.fireBtn.classList.add('is-active');
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerId === this._joyId) this._updateJoy(e);
      else if (e.pointerId === this._thrId) this._updateThrottle(e);
    });
    window.addEventListener('pointerup', (e) => this._release(e));
    window.addEventListener('pointercancel', (e) => this._release(e));
  }

  _release(e) {
    if (e.pointerId === this._joyId) {
      this._joyId = null;
      this.steerX = 0; this.steerY = 0;
      this.knob.style.transform = 'translate(-50%, -50%)';
    } else if (e.pointerId === this._thrId) {
      this._thrId = null;
    } else if (e.pointerId === this._fireId) {
      this._fireId = null;
      this.firing = false;
      this.fireBtn.classList.remove('is-active');
    }
  }

  _updateJoy(e) {
    const r = this.joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    this.steerX = dx / max;
    this.steerY = dy / max;
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  _updateThrottle(e) {
    const r = this.throttleEl.querySelector('.throttle__track').getBoundingClientRect();
    let t = 1 - (e.clientY - r.top) / r.height;
    t = Math.max(0, Math.min(1, t));
    this.throttle = t;
    this._layoutThrottle();
  }

  _layoutThrottle() {
    this.tfill.style.height = (this.throttle * 100) + '%';
    this.tknob.style.bottom = `calc(${this.throttle * 100}% - 14px)`;
  }

  dispose() { if (this.root.parentNode) this.root.parentNode.removeChild(this.root); }
}
