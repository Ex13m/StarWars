// Spawner — owns the enemy pool and drives waves. Enemies spawn staggered in the
// forward streaming corridor (and to the sides), difficulty ramps each wave, and a
// boss ("Choir" node) arrives every CONFIG.difficulty.bossEveryWaves.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { EnemyFighter } from '../entities/EnemyFighter.js';

const SPAWN_DISTANCE = 110;

export class Spawner {
  constructor(scene, poolSize = 24) {
    this.scene = scene;
    this.enemies = [];
    for (let i = 0; i < poolSize; i++) this.enemies.push(new EnemyFighter(scene));

    this.wave = 0;
    this.queue = [];          // types waiting to spawn this wave
    this.spawnTimer = 0;
    this.spawning = false;
    this._scratch = new THREE.Vector3();
  }

  get aliveCount() {
    let n = 0;
    for (const e of this.enemies) if (e.active) n++;
    return n;
  }

  get difficultyMul() {
    return 1 + CONFIG.difficulty.enemySpeedGrowth * (this.wave - 1);
  }

  isBossWave(wave = this.wave) {
    return wave > 0 && wave % CONFIG.difficulty.bossEveryWaves === 0;
  }

  startWave(wave) {
    this.wave = wave;
    this.queue = this._buildWave(wave);
    this.spawning = true;
    this.spawnTimer = 0.4;
  }

  _buildWave(wave) {
    const d = CONFIG.difficulty;
    const list = [];
    if (this.isBossWave(wave)) {
      list.push('boss');
      const escorts = 2 + Math.floor(wave / d.bossEveryWaves);
      for (let i = 0; i < escorts; i++) list.push(i % 2 ? 'interceptor' : 'scout');
    } else {
      const count = d.baseEnemiesPerWave + d.enemiesPerWaveGrowth * (wave - 1);
      for (let i = 0; i < count; i++) {
        // Mix shifts toward tougher types as waves progress.
        const roll = Math.random() + wave * 0.04;
        list.push(roll > 1.1 ? 'bomber' : roll > 0.55 ? 'interceptor' : 'scout');
      }
    }
    return list;
  }

  /** Returns true while a wave still has enemies to spawn or alive. */
  update(dt) {
    if (this.spawning) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.queue.length > 0) {
        this._spawnOne(this.queue.shift());
        this.spawnTimer = 0.45 + Math.random() * 0.5;
      }
      if (this.queue.length === 0) this.spawning = false;
    }
  }

  /** Wave is cleared once nothing is queued and nothing is alive. */
  isWaveCleared() {
    return !this.spawning && this.queue.length === 0 && this.aliveCount === 0;
  }

  _spawnOne(type) {
    const e = this.enemies.find((x) => !x.active);
    if (!e) return;

    // Forward-biased cone so most threats come from ahead, some from the sides.
    const boss = type === 'boss';
    const halfCone = boss ? 0.15 : 1.15; // radians
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * Math.tan(halfCone);
    const dir = this._scratch.set(Math.cos(a) * r, Math.sin(a) * r * 0.7, -1).normalize();
    const pos = dir.multiplyScalar(SPAWN_DISTANCE * (boss ? 1.1 : 0.85 + Math.random() * 0.3));

    e.spawn(type, pos, this.difficultyMul);
  }

  reset() {
    for (const e of this.enemies) if (e.active) e.kill();
    this.wave = 0;
    this.queue = [];
    this.spawning = false;
  }
}
