// ProjectilePool — fixed pool of glowing laser tracers (no per-shot allocation).
// Player and enemy bolts share the pool; team + color distinguish them. Additive
// material + bloom makes them streak and glow.
import * as THREE from 'three';

const PLAYER_COLOR = 0x77ffd6;  // cool cyan-green
const ENEMY_COLOR = 0xff5a2a;   // hot orange-red — pops against the cool backdrop
const LIFETIME = 2.4;

export class ProjectilePool {
  constructor(scene, max = 160) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(0.16, 0.16, 2.6); // elongated tracer
    this.items = [];
    for (let i = 0; i < max; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: PLAYER_COLOR,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.items.push({
        mesh,
        active: false,
        vel: new THREE.Vector3(),
        life: 0,
        team: 'player',
        damage: 0,
        radius: 0.7,
      });
    }
    this._fwd = new THREE.Vector3(0, 0, 1);
    this._dir = new THREE.Vector3();
  }

  /** dir is a normalized THREE.Vector3 (direction of travel). */
  spawn(pos, dir, speed, team, damage) {
    const p = this.items.find((i) => !i.active);
    if (!p) return null;
    p.active = true;
    p.team = team;
    p.damage = damage;
    p.life = LIFETIME;
    this._dir.copy(dir).normalize();
    p.vel.copy(this._dir).multiplyScalar(speed);
    p.mesh.position.copy(pos);
    p.mesh.quaternion.setFromUnitVectors(this._fwd, this._dir);
    p.mesh.material.color.setHex(team === 'player' ? PLAYER_COLOR : ENEMY_COLOR);
    // Enemy bolts are fatter so incoming fire is unmistakable.
    if (team === 'player') p.mesh.scale.set(1, 1, 1);
    else p.mesh.scale.set(2.6, 2.6, 1.5);
    p.mesh.visible = true;
    return p;
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.active) continue;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt;
      if (p.life <= 0) this.kill(p);
    }
  }

  kill(p) {
    p.active = false;
    p.mesh.visible = false;
  }
}
