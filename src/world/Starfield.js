// Starfield — distant stars on a sphere shell, for parallax depth BEHIND the
// rushing speed-streaks. Slowly rotates so the far field feels alive but calm.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Starfield {
  constructor(scene) {
    const { count, radius, size, color } = CONFIG.starfield;
    const positions = new Float32Array(count * 3);

    // Uniformly scatter points on a sphere shell around the origin (the cockpit).
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (0.85 + Math.random() * 0.15);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt) {
    this.points.rotation.y += dt * 0.005;
    this.points.rotation.x += dt * 0.002;
  }
}
