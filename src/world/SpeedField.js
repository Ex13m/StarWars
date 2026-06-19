// SpeedField — the rushing-particle streaks that SELL the sense of flight.
//
// The ship "flies forward" (-Z) but the camera stays put; instead the universe
// streams toward the camera (+Z). Each streak is a short line whose length grows
// with speed (warp-stretch). When a streak passes behind the camera it recycles
// to the far end of the corridor. Additive blending + bloom makes them glow.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class SpeedField {
  constructor(scene) {
    const c = CONFIG.speedField;
    this.cfg = c;
    this.count = c.count;
    this.speed = CONFIG.flight.cruiseSpeed;

    // Per-streak persistent state: lateral x/y (stay fixed) and streaming z.
    this.x = new Float32Array(this.count);
    this.y = new Float32Array(this.count);
    this.z = new Float32Array(this.count);

    // 2 vertices (head + tail) per streak.
    this.positions = new Float32Array(this.count * 2 * 3);

    for (let i = 0; i < this.count; i++) this._respawn(i, true);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo = geo;

    const mat = new THREE.LineBasicMaterial({
      color: c.color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    this.lines = new THREE.LineSegments(geo, mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  // Place streak i somewhere in the corridor. spread=true on initial fill so they
  // don't all start at the far plane.
  _respawn(i, spread) {
    const c = this.cfg;
    // Random point in a disc (sqrt for uniform area), kept away from dead-center.
    const ang = Math.random() * Math.PI * 2;
    const rad = (0.08 + 0.92 * Math.sqrt(Math.random())) * c.radius;
    this.x[i] = Math.cos(ang) * rad;
    this.y[i] = Math.sin(ang) * rad;
    this.z[i] = spread ? -Math.random() * c.depth : -c.depth + this.z[i] % 1;
  }

  /** target streaming speed (world units/sec) — eased toward by Game. */
  setSpeed(speed) {
    this.speed = speed;
  }

  update(dt) {
    const c = this.cfg;
    const pos = this.positions;

    // Streak length scales from cruise (short) to boost (long warp lines).
    const t = THREE.MathUtils.clamp(
      (this.speed - CONFIG.flight.cruiseSpeed) /
        (CONFIG.flight.boostSpeed - CONFIG.flight.cruiseSpeed),
      0, 1
    );
    const streak = c.minStreak + (c.maxStreak - c.minStreak) * t;

    const dz = this.speed * dt;
    for (let i = 0; i < this.count; i++) {
      let z = this.z[i] + dz;
      if (z > c.near) {
        this._respawn(i, false);
        z = this.z[i];
      }
      this.z[i] = z;

      const o = i * 6;
      const x = this.x[i];
      const y = this.y[i];
      // Head leads at z; tail trails behind in -Z by `streak`.
      pos[o + 0] = x; pos[o + 1] = y; pos[o + 2] = z;
      pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = z - streak;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
