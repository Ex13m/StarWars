// Input — unifies aiming and firing across phone and desktop.
//
//  - Aiming: device gyroscope (DeviceOrientation) when available; otherwise drag.
//  - Firing: pointer down (tap/hold). A quick tap fires once; holding auto-fires.
//
// Exposes a `quaternion` (where the player is looking) that Game applies to the
// camera, plus `firing` and `yawDelta` (for banking). All gyro math is the
// well-known DeviceOrientation -> quaternion routine, kept compact.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const DEG2RAD = Math.PI / 180;

export class Input {
  constructor(domElement) {
    this.dom = domElement || window;
    this.quaternion = new THREE.Quaternion();
    this.firing = false;
    this.yawDelta = 0;        // change in yaw this frame (for banking)
    this.boosting = false;

    this._mode = 'drag';      // becomes 'gyro' once orientation events arrive
    this._yaw = 0;
    this._pitch = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._prevYaw = 0;

    // Latest device orientation (radians) + screen orientation angle.
    this._ori = { alpha: 0, beta: 0, gamma: 0, screen: 0 };

    // scratch objects (no per-frame allocation)
    this._euler = new THREE.Euler();
    this._q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° X
    this._zee = new THREE.Vector3(0, 0, 1);
    this._qScreen = new THREE.Quaternion();

    this._bind();
  }

  _bind() {
    const d = this.dom;
    d.addEventListener('pointerdown', this._onDown = (e) => {
      this.firing = true;
      this._dragging = true;
      this._lastX = e.clientX; this._lastY = e.clientY;
    });
    window.addEventListener('pointerup', this._onUp = () => {
      this.firing = false;
      this._dragging = false;
    });
    window.addEventListener('pointermove', this._onMove = (e) => {
      if (!this._dragging || this._mode === 'gyro') return;
      const s = CONFIG.input.dragSensitivity;
      this._yaw -= (e.clientX - this._lastX) * s;
      this._pitch -= (e.clientY - this._lastY) * s;
      this._pitch = THREE.MathUtils.clamp(this._pitch, -CONFIG.input.pitchClamp, CONFIG.input.pitchClamp);
      this._lastX = e.clientX; this._lastY = e.clientY;
    });
    window.addEventListener('deviceorientation', this._onOri = (e) => {
      if (e.alpha == null) return;
      this._mode = 'gyro';
      this._ori.alpha = e.alpha * DEG2RAD;
      this._ori.beta = e.beta * DEG2RAD;
      this._ori.gamma = e.gamma * DEG2RAD;
      this._ori.screen = (window.orientation || 0) * DEG2RAD;
    }, true);
  }

  /** iOS 13+ requires an explicit permission request from a user gesture. */
  static async requestGyroPermission() {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      try { return (await D.requestPermission()) === 'granted'; }
      catch { return false; }
    }
    return true; // other platforms grant implicitly
  }

  update() {
    if (this._mode === 'gyro') {
      const { alpha, beta, gamma, screen } = this._ori;
      this._euler.set(beta, alpha, -gamma, 'YXZ');
      this.quaternion.setFromEuler(this._euler);
      this.quaternion.multiply(this._q1);                       // camera looks along -Z
      this.quaternion.multiply(this._qScreen.setFromAxisAngle(this._zee, -screen));
      // approximate yaw for banking from the alpha channel
      const yaw = alpha;
      this.yawDelta = shortestAngle(yaw - this._prevYaw);
      this._prevYaw = yaw;
    } else {
      this._euler.set(this._pitch, this._yaw, 0, 'YXZ');
      this.quaternion.setFromEuler(this._euler);
      this.yawDelta = this._yaw - this._prevYaw;
      this._prevYaw = this._yaw;
    }
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('deviceorientation', this._onOri, true);
  }
}

function shortestAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
