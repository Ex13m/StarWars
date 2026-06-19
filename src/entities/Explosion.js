// ExplosionPool — pooled multi-layer explosions: a burst of glowing debris
// particles + an expanding shockwave ring + a quick flash. Additive + bloom sells
// the cinematic pop. Each instance reuses its geometry; nothing allocates at runtime.
import * as THREE from 'three';

const PARTICLES = 22;

export class ExplosionPool {
  constructor(scene, max = 16) {
    this.scene = scene;
    this.items = [];
    for (let i = 0; i < max; i++) this.items.push(this._make(scene));
  }

  _make(scene) {
    // Debris particles (a small Points cloud with per-particle velocities).
    const positions = new Float32Array(PARTICLES * 3);
    const velocities = new Float32Array(PARTICLES * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffd27f,
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const points = new THREE.Points(geo, pMat);
    points.visible = false;
    points.frustumCulled = false;
    scene.add(points);

    // Shockwave ring.
    const ringGeo = new THREE.RingGeometry(0.6, 1.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffae5c,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.visible = false;
    ring.frustumCulled = false;
    scene.add(ring);

    return { points, ring, positions, velocities, active: false, time: 0, duration: 0.8, scale: 1 };
  }

  spawn(pos, scale = 1, color = 0xffd27f) {
    const e = this.items.find((i) => !i.active);
    if (!e) return;
    e.active = true;
    e.time = 0;
    e.duration = 0.7 + 0.25 * scale;
    e.scale = scale;

    e.points.position.copy(pos);
    e.points.material.color.setHex(color);
    e.points.material.opacity = 1;
    for (let i = 0; i < PARTICLES; i++) {
      e.positions[i * 3 + 0] = 0;
      e.positions[i * 3 + 1] = 0;
      e.positions[i * 3 + 2] = 0;
      // random outward velocity on a sphere
      const a = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - z * z);
      const sp = (6 + Math.random() * 10) * scale;
      e.velocities[i * 3 + 0] = Math.cos(a) * r * sp;
      e.velocities[i * 3 + 1] = Math.sin(a) * r * sp;
      e.velocities[i * 3 + 2] = z * sp;
    }
    e.points.geometry.attributes.position.needsUpdate = true;
    e.points.visible = true;

    e.ring.position.copy(pos);
    e.ring.material.opacity = 0.9;
    e.ring.scale.setScalar(scale * 0.6);
    e.ring.visible = true;
    // Face a random orientation so rings don't all look identical.
    e.ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  }

  update(dt, camera) {
    for (const e of this.items) {
      if (!e.active) continue;
      e.time += dt;
      const t = e.time / e.duration;
      if (t >= 1) { this._kill(e); continue; }

      // Particles fly out and decelerate; fade as they age.
      const drag = 1 - Math.min(1, dt * 2.2);
      for (let i = 0; i < PARTICLES; i++) {
        e.positions[i * 3 + 0] += e.velocities[i * 3 + 0] * dt;
        e.positions[i * 3 + 1] += e.velocities[i * 3 + 1] * dt;
        e.positions[i * 3 + 2] += e.velocities[i * 3 + 2] * dt;
        e.velocities[i * 3 + 0] *= drag;
        e.velocities[i * 3 + 1] *= drag;
        e.velocities[i * 3 + 2] *= drag;
      }
      e.points.geometry.attributes.position.needsUpdate = true;
      e.points.material.opacity = 1 - t;

      // Shockwave expands fast and fades; billboard toward the camera.
      e.ring.scale.setScalar(e.scale * (0.6 + t * 6));
      e.ring.material.opacity = 0.9 * (1 - t);
      if (camera) e.ring.lookAt(camera.position);
    }
  }

  _kill(e) {
    e.active = false;
    e.points.visible = false;
    e.ring.visible = false;
  }
}
