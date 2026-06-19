// Game — orchestrator and main loop. Owns the renderer, camera, world layers and
// the per-frame update order. This slice delivers the FLIGHT FEEL: rushing warp
// streaks, banking, FOV "punch" on boost, engine audio and camera shake. Combat
// entities/systems plug into update() in the next slice.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { setupScene } from '../world/SceneSetup.js';
import { Starfield } from '../world/Starfield.js';
import { SpeedField } from '../world/SpeedField.js';
import { Postprocessing } from '../world/Postprocessing.js';
import { Input } from './Input.js';
import { ARCamera } from '../ar/ARCamera.js';

export class Game {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.running = false;

    // Renderer — alpha:true so the AR camera video shows through empty space.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0); // transparent
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    Object.assign(this.renderer.domElement.style, { position: 'fixed', inset: '0' });
    root.appendChild(this.renderer.domElement);

    const r = CONFIG.render;
    this.camera = new THREE.PerspectiveCamera(r.fov, window.innerWidth / window.innerHeight, r.near, r.far);

    this.scene = new THREE.Scene();
    setupScene(this.scene);
    this.starfield = new Starfield(this.scene);
    this.speedField = new SpeedField(this.scene);
    this.post = new Postprocessing(this.renderer, this.scene, this.camera);

    this.input = new Input(this.renderer.domElement);
    this.arCamera = new ARCamera();

    // Flight state.
    this.speed = CONFIG.flight.cruiseSpeed;
    this.bank = 0;
    this.recoil = 0;

    // scratch
    this._qLook = new THREE.Quaternion();
    this._qRoll = new THREE.Quaternion();
    this._zAxis = new THREE.Vector3(0, 0, 1);
    this._xAxis = new THREE.Vector3(1, 0, 0);

    this.clock = new THREE.Clock();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  async start() {
    // Try AR camera background; pure-space fallback is fine if denied.
    await Input.requestGyroPermission();
    await this.arCamera.enable();

    this.running = true;
    this.clock.start();
    this._loop();
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05); // clamp to avoid huge steps

    this.input.update();

    // TEMP: hold-to-boost so the flight-feel is interactive before weapons exist.
    // (Boost will get its own HUD button once combat lands.)
    const boosting = this.input.firing || this.input.boosting;
    const targetSpeed = boosting ? CONFIG.flight.boostSpeed : CONFIG.flight.cruiseSpeed;
    this.speed += (targetSpeed - this.speed) * Math.min(1, CONFIG.flight.speedLerp * dt);
    this.speedField.setSpeed(this.speed);

    const t = THREE.MathUtils.clamp(
      (this.speed - CONFIG.flight.cruiseSpeed) /
        (CONFIG.flight.boostSpeed - CONFIG.flight.cruiseSpeed), 0, 1);

    // FOV punch: widen field of view with speed for a visceral acceleration kick.
    const fov = CONFIG.render.fov + (CONFIG.render.fovBoost - CONFIG.render.fov) * t;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // --- Camera orientation = look (gyro/drag) + bank + recoil ---
    this._qLook.copy(this.input.quaternion);

    // Banking: roll into turns, proportional to how fast we're yawing.
    const targetBank = THREE.MathUtils.clamp(
      -this.input.yawDelta * 40, -CONFIG.flight.bankAmount, CONFIG.flight.bankAmount);
    this.bank += (targetBank - this.bank) * Math.min(1, CONFIG.flight.bankLerp * dt);
    this._qRoll.setFromAxisAngle(this._zAxis, this.bank);
    this._qLook.multiply(this._qRoll);

    // Weapon recoil (decays each frame; weapons add to it later).
    this.recoil += (0 - this.recoil) * Math.min(1, CONFIG.weaponFeel.recoilReturn * dt);
    if (this.recoil > 0.0001) {
      this._qRoll.setFromAxisAngle(this._xAxis, this.recoil);
      this._qLook.multiply(this._qRoll);
    }

    this.camera.quaternion.copy(this._qLook);

    // Boost micro-shake — a touch of G-force rumble at high speed.
    const shake = CONFIG.flight.shakeOnBoost * t;
    if (shake > 0.001) {
      this.camera.position.set(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
        0
      );
    } else {
      this.camera.position.set(0, 0, 0);
    }

    // World + audio.
    this.starfield.update(dt);
    this.speedField.update(dt);
    if (this.audio) {
      this.audio.setEngine(t);
      this.audio.updateListener(this.camera);
    }

    this.post.render();
  }

  /** Called by the weapon system later to kick the camera on each shot. */
  addRecoil(amount = CONFIG.weaponFeel.recoilKick) {
    this.recoil += amount;
  }

  stop() {
    this.running = false;
    window.removeEventListener('resize', this._onResize);
    this.input.dispose();
    this.arCamera.disable();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
