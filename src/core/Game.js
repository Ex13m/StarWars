// Game — orchestrator and main loop. Owns the renderer, camera, world layers,
// combat systems and UI, and defines the per-frame update order.
//
// Controls: on-screen joystick (steer), throttle slider (speed/boost), FIRE.
// Feel: rushing warp streaks + a whole battle ("Armada") you fly through, visible
// gun barrels that recoil and flash, banking, FOV punch, camera shake, 3D audio.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { setupScene } from '../world/SceneSetup.js';
import { Starfield } from '../world/Starfield.js';
import { Nebula } from '../world/Nebula.js';
import { SpeedField } from '../world/SpeedField.js';
import { Armada } from '../world/Armada.js';
import { Postprocessing } from '../world/Postprocessing.js';
import { Cockpit } from '../world/Cockpit.js';
import { ARCamera } from '../ar/ARCamera.js';
import { Player } from '../entities/Player.js';
import { Spawner } from '../systems/Spawner.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { updateEnemyAI } from '../systems/EnemyAI.js';
import { HUD } from '../ui/HUD.js';
import { Screens } from '../ui/Screens.js';
import { Controls } from '../ui/Controls.js';

export class Game {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.running = false;
    this.state = 'idle';

    // renderer (alpha for AR compositing)
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
    this.scene.add(this.camera); // so the camera-parented cockpit renders

    this.starfield = new Starfield(this.scene);
    this.nebula = new Nebula(this.scene);
    this.armada = new Armada(this.scene);          // the large-scale battle you fly through
    this.speedField = new SpeedField(this.scene);
    this.post = new Postprocessing(this.renderer, this.scene, this.camera);
    this.cockpit = new Cockpit(this.camera);       // visible twin gun barrels

    this.arCamera = new ARCamera();

    // gameplay
    this.player = new Player();
    this.score = new ScoreSystem();
    this.spawner = new Spawner(this.scene);
    this.combat = new CombatSystem(this.scene, {
      player: this.player, score: this.score, audio: this.audio,
      hooks: { onRecoil: () => this.addRecoil(), onPlayerHit: () => this._onPlayerHit() },
    });

    this.hud = new HUD(); this.hud.mount();
    this.screens = new Screens(); this.screens.mount();
    this.controls = new Controls(); this.controls.mount();

    this.aiCtx = {
      up: new THREE.Vector3(0, 1, 0),
      tmpDir: new THREE.Vector3(),
      tmpPerp: new THREE.Vector3(),
      fireAt: (e) => this.combat.enemyFire(e),
      fireSpread: (e, n, a) => this.combat.enemyFireSpread(e, n, a),
    };
    this._bossPhase = 0;

    // flight + run state
    this.yaw = 0; this.pitch = 0;
    this.speed = CONFIG.flight.cruiseSpeed;
    this.bank = 0; this.recoil = 0; this.hitShake = 0;
    this.wave = 0; this.betweenWaves = false; this.waveTimer = 0;

    // scratch
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._qRoll = new THREE.Quaternion();
    this._zAxis = new THREE.Vector3(0, 0, 1);
    this._xAxis = new THREE.Vector3(1, 0, 0);
    this._fwd = new THREE.Vector3();
    this._tip = new THREE.Vector3();

    this.clock = new THREE.Clock();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  async start() {
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
    this.controls.setVisible(true);
    this.state = 'playing';
    this.wave = 0;
    this.betweenWaves = false;
    this._bossPhase = 0;
    this._nextWave();
  }

  _nextWave() {
    this.wave += 1;
    this.spawner.startWave(this.wave);
    this.hud.flashWarp();
    if (this.spawner.isBossWave(this.wave)) {
      this.hud.showBanner('⚠ ХОР ПРИБЛИЖАЕТСЯ');
      this.audio.setMusic('boss');
    } else {
      this.hud.showBanner('ВОЛНА ' + this.wave);
      this.audio.setMusic('combat');
    }
  }

  _fire() {
    this.player.onFire();
    this.combat.aimDir(this._fwd, this.camera, this.spawner.enemies);
    this.camera.updateMatrixWorld();
    for (let i = 0; i < 2; i++) {
      this.cockpit.barrelTipWorld(i, this._tip);
      this.combat.spawnPlayerBolt(this._tip, this._fwd);
      this.cockpit.fire(i);
    }
    this.audio.play('laserPlayer', { pos: this.camera.position });
    this.addRecoil();
    vibrate(CONFIG.weaponFeel.haptics.fire);
  }

  addRecoil(amount = CONFIG.weaponFeel.recoilKick) { this.recoil += amount; }

  _findBoss() {
    for (const e of this.spawner.enemies) if (e.active && e.type === 'boss') return e;
    return null;
  }

  // Watch the boss's HP phase and react on each escalation: enrage visuals,
  // summon escorts, banner + roar. Phase only ever rises (HP falls).
  _updateBoss() {
    const boss = this._findBoss();
    if (!boss) { this._bossPhase = 0; return; }
    const ph = boss.bossPhase();
    if (ph > this._bossPhase) {
      const prev = this._bossPhase;
      this._bossPhase = ph;
      if (prev > 0 && ph >= 2) this._onBossPhase(ph, boss); // skip the initial 0→1
    }
  }

  _onBossPhase(ph, boss) {
    boss.enrage(ph);
    const escorts = CONFIG.boss.escortsByPhase[ph - 1];
    if (escorts > 0) this.spawner.summonEscorts(escorts);
    this.hud.showBanner(ph >= 3 ? '⚠ ХОР: ЯРОСТЬ' : 'ХОР: РАСКОЛ — ЗАЛП');
    this.audio.play('explosionBig');
    vibrate(CONFIG.weaponFeel.haptics.explosion);
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
    this.controls.setVisible(false);
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
    this.controls.setVisible(false);
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

    if (playing) this._updateGameplay(dt);
    this._updateFlightAndRender(dt, playing);
  }

  _updateGameplay(dt) {
    if (this.controls.firing && this.player.canFire()) this._fire();

    this.player.update(dt);
    this.score.update(dt);
    this.spawner.update(dt);
    for (const e of this.spawner.enemies) if (e.active) updateEnemyAI(e, this.aiCtx, dt);
    this.combat.update(dt, this.spawner.enemies, this.camera);
    this._updateBoss();

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
    // throttle slider -> target speed (top of slider = warp boost)
    const thr = this.controls.throttle;
    const targetSpeed = CONFIG.flight.cruiseSpeed +
      (CONFIG.flight.boostSpeed - CONFIG.flight.cruiseSpeed) * thr;
    this.speed += (targetSpeed - this.speed) * Math.min(1, CONFIG.flight.speedLerp * dt);
    const t = THREE.MathUtils.clamp(
      (this.speed - CONFIG.flight.cruiseSpeed) /
        (CONFIG.flight.boostSpeed - CONFIG.flight.cruiseSpeed), 0, 1);

    // FOV punch
    const fov = CONFIG.render.fov + (CONFIG.render.fovBoost - CONFIG.render.fov) * t;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // steering from the joystick
    if (playing) {
      const rate = CONFIG.input.turnRate;
      this.yaw -= this.controls.steerX * rate * dt;
      this.pitch -= this.controls.steerY * rate * dt;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -CONFIG.input.pitchClamp, CONFIG.input.pitchClamp);
    }
    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);

    // bank into the turn
    const targetBank = THREE.MathUtils.clamp(
      -this.controls.steerX * CONFIG.flight.bankAmount, -CONFIG.flight.bankAmount, CONFIG.flight.bankAmount);
    this.bank += (targetBank - this.bank) * Math.min(1, CONFIG.flight.bankLerp * dt);
    this._qRoll.setFromAxisAngle(this._zAxis, this.bank);
    this.camera.quaternion.multiply(this._qRoll);

    // weapon recoil kick
    this.recoil += (0 - this.recoil) * Math.min(1, CONFIG.weaponFeel.recoilReturn * dt);
    if (this.recoil > 0.0001) {
      this._qRoll.setFromAxisAngle(this._xAxis, this.recoil);
      this.camera.quaternion.multiply(this._qRoll);
    }

    // shake: boost rumble + decaying damage kick
    this.hitShake = Math.max(0, this.hitShake - dt * 2.2);
    const shake = CONFIG.flight.shakeOnBoost * t + this.hitShake;
    this.camera.position.set(
      shake > 0.001 ? (Math.random() - 0.5) * shake : 0,
      shake > 0.001 ? (Math.random() - 0.5) * shake : 0, 0);

    // world streams at the flight speed
    this.speedField.setSpeed(this.speed);
    this.speedField.update(dt);
    this.armada.setFlow(this.speed);
    this.armada.update(dt);
    this.starfield.update(dt);
    this.nebula.update(dt);
    this.cockpit.update(dt);

    if (this.audio) {
      this.audio.setEngine(t);
      this.audio.updateListener(this.camera);
    }

    if (this.state !== 'over') {
      this.hud.update(dt, {
        player: this.player, score: this.score, wave: this.wave,
        camera: this.camera, enemies: this.spawner.enemies, boss: this._findBoss(),
        speed: this.speed, throttleT: thr,
      });
    }
    this.post.render();
  }

  stop() {
    this.running = false;
    window.removeEventListener('resize', this._onResize);
    this.controls.dispose();
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
