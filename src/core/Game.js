// Game — orchestrator and main loop. Owns the renderer, camera, world layers,
// combat systems and UI, and defines the per-frame update order.
//
// Flight feel: rushing warp streaks, banking, FOV punch + micro-shake on boost,
// engine audio. Combat: wave spawning, enemy AI, weapons with recoil/haptics,
// pooled explosions, score/combo, HUD radar, and end screens.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { setupScene } from '../world/SceneSetup.js';
import { Starfield } from '../world/Starfield.js';
import { Nebula } from '../world/Nebula.js';
import { SpeedField } from '../world/SpeedField.js';
import { Postprocessing } from '../world/Postprocessing.js';
import { Input } from './Input.js';
import { ARCamera } from '../ar/ARCamera.js';
import { Player } from '../entities/Player.js';
import { Spawner } from '../systems/Spawner.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { updateEnemyAI } from '../systems/EnemyAI.js';
import { HUD } from '../ui/HUD.js';
import { Screens } from '../ui/Screens.js';

export class Game {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.running = false;
    this.state = 'idle'; // 'playing' | 'over'

    // --- renderer (alpha for AR compositing) ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    Object.assign(this.renderer.domElement.style, { position: 'fixed', inset: '0' });
    root.appendChild(this.renderer.domElement);

    const r = CONFIG.render;
    this.camera = new THREE.PerspectiveCamera(r.fov, window.innerWidth / window.innerHeight, r.near, r.far);

    this.scene = new THREE.Scene();
    setupScene(this.scene);
    this.starfield = new Starfield(this.scene);
    this.nebula = new Nebula(this.scene);
    this.speedField = new SpeedField(this.scene);
    this.post = new Postprocessing(this.renderer, this.scene, this.camera);

    // Muzzle flash: a small additive quad parked in front of the camera on each shot.
    const mMat = new THREE.MeshBasicMaterial({
      color: 0x9ffcff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.muzzle = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mMat);
    this.muzzle.visible = false;
    this.muzzle.frustumCulled = false;
    this.scene.add(this.muzzle);
    this.muzzleTimer = 0;
    this._fwdScratch = new THREE.Vector3();

    this.input = new Input(this.renderer.domElement);
    this.arCamera = new ARCamera();

    // --- gameplay ---
    this.player = new Player();
    this.score = new ScoreSystem();
    this.spawner = new Spawner(this.scene);
    this.combat = new CombatSystem(this.scene, {
      player: this.player,
      score: this.score,
      audio: this.audio,
      hooks: {
        onRecoil: () => this.addRecoil(),
        onPlayerHit: () => this._onPlayerHit(),
      },
    });

    this.hud = new HUD({
      onBoost: () => this.requestBoost(),
      onFireDown: () => { this._fireBtn = true; },
      onFireUp: () => { this._fireBtn = false; },
    });
    this.hud.mount();
    this.screens = new Screens();
    this.screens.mount();

    // AI context with shared scratch (no per-frame allocation).
    this.aiCtx = {
      up: new THREE.Vector3(0, 1, 0),
      tmpDir: new THREE.Vector3(),
      tmpPerp: new THREE.Vector3(),
      fireAt: (e) => this.combat.enemyFire(e),
    };

    // flight + run state
    this.speed = CONFIG.flight.cruiseSpeed;
    this.bank = 0;
    this.recoil = 0;
    this.hitShake = 0;
    this.wave = 0;
    this.betweenWaves = false;
    this.waveTimer = 0;
    this._fireBtn = false;

    // scratch
    this._qRoll = new THREE.Quaternion();
    this._zAxis = new THREE.Vector3(0, 0, 1);
    this._xAxis = new THREE.Vector3(1, 0, 0);

    this.clock = new THREE.Clock();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  async start() {
    await Input.requestGyroPermission();
    await this.arCamera.enable();
    this._startRun();
    this.running = true;
    this.clock.start();
    this._loop();
  }

  _startRun() {
    this.player.reset();
    this.score.reset();
    this.spawner.reset();
    this.combat.reset();
    this.screens.hide();
    this.hud.setVisible(true);
    this.state = 'playing';
    this.wave = 0;
    this.betweenWaves = false;
    this._nextWave();
  }

  _nextWave() {
    this.wave += 1;
    this.spawner.startWave(this.wave);
    this.hud.flashWarp(); // warp-jump flash on each new wave
    if (this.spawner.isBossWave(this.wave)) {
      this.hud.showBanner('⚠ ХОР ПРИБЛИЖАЕТСЯ');
      this.audio.setMusic('boss');
    } else {
      this.hud.showBanner('ВОЛНА ' + this.wave);
      this.audio.setMusic('combat');
    }
  }

  requestBoost() {
    if (this.state !== 'playing') return;
    if (this.player.tryBoost()) {
      this.audio.play('thruster');
      vibrate(CONFIG.weaponFeel.haptics.boost);
    }
  }

  _onPlayerHit() {
    this.hud.flashDamage();
    this.hitShake = Math.max(this.hitShake, CONFIG.weaponFeel.shakeOnHit);
    if (!this.player.alive) this._gameOver();
  }

  _gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.audio.play('explosionBig');
    vibrate(CONFIG.weaponFeel.haptics.explosion);
    const newBest = this.score.commitBest();
    this.hud.setVisible(false);
    this.screens.show({
      victory: false, score: this.score.score, best: this.score.best,
      wave: this.wave, newBest, onRetry: () => this._startRun(),
    });
  }

  _victory() {
    if (this.state === 'over') return;
    this.state = 'over';
    const newBest = this.score.commitBest();
    this.hud.setVisible(false);
    this.screens.show({
      victory: true, score: this.score.score, best: this.score.best,
      wave: this.wave, newBest, onRetry: () => this._startRun(),
    });
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
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const playing = this.state === 'playing';

    this.input.update();

    if (playing) this._updateGameplay(dt);

    this._updateFlightAndRender(dt, playing);
  }

  _updateGameplay(dt) {
    // Fire (tap anywhere or hold FIRE button).
    if ((this.input.firing || this._fireBtn) && this.player.canFire()) {
      this.combat.playerFire(this.camera, this.spawner.enemies);
    }

    this.player.update(dt);
    this.score.update(dt);

    // Spawn + drive enemies.
    this.spawner.update(dt);
    for (const e of this.spawner.enemies) {
      if (e.active) updateEnemyAI(e, this.aiCtx, dt);
    }

    this.combat.update(dt, this.spawner.enemies, this.camera);

    // Wave progression.
    if (!this.betweenWaves && this.spawner.isWaveCleared()) {
      if (this.spawner.isBossWave(this.wave)) {
        this._victory();
      } else {
        this.betweenWaves = true;
        this.waveTimer = 2.2;
        this.hud.showBanner('ВОЛНА ОЧИЩЕНА');
      }
    }
    if (this.betweenWaves) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) { this.betweenWaves = false; this._nextWave(); }
    }
  }

  _updateFlightAndRender(dt, playing) {
    // Speed eases toward boost or cruise.
    const boosting = playing && this.player.boosting;
    const targetSpeed = boosting ? CONFIG.flight.boostSpeed : CONFIG.flight.cruiseSpeed;
    this.speed += (targetSpeed - this.speed) * Math.min(1, CONFIG.flight.speedLerp * dt);
    this.speedField.setSpeed(this.speed);

    const t = THREE.MathUtils.clamp(
      (this.speed - CONFIG.flight.cruiseSpeed) /
        (CONFIG.flight.boostSpeed - CONFIG.flight.cruiseSpeed), 0, 1);

    // FOV punch.
    const fov = CONFIG.render.fov + (CONFIG.render.fovBoost - CONFIG.render.fov) * t;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // Orientation = look (gyro/drag) + bank + recoil.
    this.camera.quaternion.copy(this.input.quaternion);

    const targetBank = THREE.MathUtils.clamp(
      -this.input.yawDelta * 40, -CONFIG.flight.bankAmount, CONFIG.flight.bankAmount);
    this.bank += (targetBank - this.bank) * Math.min(1, CONFIG.flight.bankLerp * dt);
    this._qRoll.setFromAxisAngle(this._zAxis, this.bank);
    this.camera.quaternion.multiply(this._qRoll);

    this.recoil += (0 - this.recoil) * Math.min(1, CONFIG.weaponFeel.recoilReturn * dt);
    if (this.recoil > 0.0001) {
      this._qRoll.setFromAxisAngle(this._xAxis, this.recoil);
      this.camera.quaternion.multiply(this._qRoll);
    }

    // Shake: boost rumble + decaying damage kick.
    this.hitShake = Math.max(0, this.hitShake - dt * 2.2);
    const shake = CONFIG.flight.shakeOnBoost * t + this.hitShake;
    if (shake > 0.001) {
      this.camera.position.set(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake, 0);
    } else {
      this.camera.position.set(0, 0, 0);
    }

    // Muzzle flash tracks the view and fades fast.
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      this._fwdScratch.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.muzzle.position.copy(this.camera.position).addScaledVector(this._fwdScratch, 5);
      this.muzzle.quaternion.copy(this.camera.quaternion);
      this.muzzle.material.opacity = Math.max(0, this.muzzleTimer / (CONFIG.weaponFeel.muzzleFlashMs / 1000)) * 0.9;
      this.muzzle.visible = true;
    } else if (this.muzzle.visible) {
      this.muzzle.visible = false;
    }

    // World + audio + HUD + render.
    this.starfield.update(dt);
    this.nebula.update(dt);
    this.speedField.update(dt);
    if (this.audio) {
      this.audio.setEngine(t);
      this.audio.updateListener(this.camera);
    }
    if (this.state !== 'over') {
      this.hud.update(dt, {
        player: this.player, score: this.score, wave: this.wave,
        camera: this.camera, enemies: this.spawner.enemies, boss: this._findBoss(),
      });
    }
    this.post.render();
  }

  addRecoil(amount = CONFIG.weaponFeel.recoilKick) {
    this.recoil += amount;
    // fire the muzzle flash on the same beat as the recoil kick
    this.muzzleTimer = CONFIG.weaponFeel.muzzleFlashMs / 1000;
    this.muzzle.rotation.z = Math.random() * Math.PI;
  }

  _findBoss() {
    for (const e of this.spawner.enemies) if (e.active && e.type === 'boss') return e;
    return null;
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

function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}
