// EnemyFighter — a Sileni swarm-craft built from primitives (no asset files).
// Crystalline silicon look: dark metallic body, glowing core, angular wings.
// Holds combat + AI state; movement/firing decisions live in systems/EnemyAI.js.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Per-type tuning. radius is used for hit detection. (Boss = the "Choir" node.)
export const ENEMY_TYPES = {
  scout:       { hp: 30,  radius: 1.6, scale: 0.9, speed: 26, fireRate: 0,    points: 100,  color: 0x6fe0ff },
  interceptor: { hp: 55,  radius: 1.8, scale: 1.1, speed: 20, fireRate: 2.2,  points: 250,  color: 0xff4d6d },
  bomber:      { hp: 110, radius: 2.6, scale: 1.7, speed: 12, fireRate: 3.4,  points: 400,  color: 0xc77dff },
  boss:        { hp: 1400, radius: 6.0, scale: 4.2, speed: 7,  fireRate: 1.1,  points: 5000, color: 0xff7849 },
};

export class EnemyFighter {
  constructor(scene) {
    this.scene = scene;
    this.group = buildMesh();
    this.group.visible = false;
    scene.add(this.group);
    this.active = false;
    this.type = 'scout';
    this.hp = 1;
    this.maxHp = 1;
    this.radius = 1.6;
    this.speed = 20;
    this.fireRate = 0;
    this.fireTimer = 0;
    this.points = 0;
    this.state = 'approach';
    this.stateTime = 0;
    this.fireFlash = 0;   // brief core-pulse when this enemy shoots (telegraph)
    this.vel = new THREE.Vector3();
  }

  get position() { return this.group.position; }

  spawn(type, pos, difficultyMul = 1) {
    const t = ENEMY_TYPES[type] || ENEMY_TYPES.scout;
    this.type = type;
    this.maxHp = t.hp;
    this.hp = t.hp;
    this.radius = t.radius;
    this.speed = t.speed * difficultyMul;
    this.fireRate = t.fireRate;
    this.fireTimer = Math.random() * 1.5;
    this.points = t.points;
    this.state = 'approach';
    this.stateTime = 0;
    this.vel.set(0, 0, 0);

    this.group.position.copy(pos);
    this.group.scale.setScalar(t.scale);
    this._setCore(t.color);
    this.group.visible = true;
    this.active = true;
  }

  _setCore(hex) {
    const core = this.group.getObjectByName('core');
    if (core) core.material.color.setHex(hex);
  }

  /** Telegraph: flash the core so the player sees WHICH enemy just fired. */
  markFire() { this.fireFlash = 0.18; }

  damage(amount) {
    this.hp -= amount;
    // brief hit flash via emissive bump
    const body = this.group.getObjectByName('body');
    if (body) body.material.emissiveIntensity = 1.6;
    return this.hp <= 0;
  }

  /** Boss phase from current HP: 1 (calm) → 2 (volley) → 3 (enraged). */
  bossPhase() {
    const f = this.hp / this.maxHp;
    if (f > CONFIG.boss.phase2At) return 1;
    if (f > CONFIG.boss.phase3At) return 2;
    return 3;
  }

  /** Visual escalation when the boss enters a new phase. */
  enrage(phase) {
    this._setCore(CONFIG.boss.coreColor[phase - 1]);
    this.group.scale.setScalar((ENEMY_TYPES.boss.scale) * (1 + (phase - 1) * 0.08));
    const body = this.group.getObjectByName('body');
    if (body) body.material.emissiveIntensity = 1.2;
  }

  kill() {
    this.active = false;
    this.group.visible = false;
  }

  // Called each frame after AI sets velocity + facing: integrate position and
  // decay the hit-flash. (Facing is set by the AI via group.lookAt.)
  integrate(dt) {
    this.group.position.addScaledVector(this.vel, dt);
    const body = this.group.getObjectByName('body');
    if (body && body.material.emissiveIntensity > 0.5) {
      body.material.emissiveIntensity = Math.max(0.5, body.material.emissiveIntensity - dt * 4);
    }
    // Fire telegraph: pop the core big+bright, then settle back.
    const core = this.group.getObjectByName('core');
    if (core) {
      if (this.fireFlash > 0) this.fireFlash = Math.max(0, this.fireFlash - dt);
      core.scale.setScalar(1 + this.fireFlash * 10);
    }
  }
}

function buildMesh() {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x241f38, metalness: 0.85, roughness: 0.35,
    emissive: 0x3a0d4a, emissiveIntensity: 0.5,
  });
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), bodyMat);
  body.name = 'body';
  g.add(body);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xff4d6d })
  );
  core.name = 'core';
  g.add(core);

  // Angular wings (flattened cones) on each side.
  const wingGeo = new THREE.ConeGeometry(0.55, 2.4, 4);
  const wl = new THREE.Mesh(wingGeo, bodyMat);
  wl.rotation.z = Math.PI / 2;
  wl.position.set(-1.2, 0, 0);
  g.add(wl);
  const wr = new THREE.Mesh(wingGeo, bodyMat);
  wr.rotation.z = -Math.PI / 2;
  wr.position.set(1.2, 0, 0);
  g.add(wr);

  return g;
}
