// Cockpit — the player's twin gun barrels, visible in the bottom of the frame.
// Parented to the camera so they always stay in view. Each shot kicks the barrel
// back (recoil) and pops a soft additive muzzle-flash sprite at its tip. Tracers
// are spawned by Game from barrelTipWorld() so they read as leaving the ship.
import * as THREE from 'three';

const BARREL_X = 0.5;
const BARREL_Y = -0.42;
const BARREL_Z = -1.0;   // gun body sits here, in front of the camera
const TIP_Z = -2.1;      // muzzle tip (where bolts/flashes originate)
const RECOIL = 0.14;

export class Cockpit {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group); // camera must be added to the scene (Game does this)

    const flashTex = glowTexture();
    this.barrels = [];
    this.flashes = [];
    this.tips = [];

    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1;
      const gun = buildGun();
      gun.position.set(sign * BARREL_X, BARREL_Y, BARREL_Z);
      gun.rotation.y = -sign * 0.04; // slight toe-in toward the crosshair
      gun.userData.restZ = gun.position.z;
      this.group.add(gun);
      this.barrels.push(gun);

      const tip = new THREE.Vector3(sign * BARREL_X, BARREL_Y, TIP_Z);
      this.tips.push(tip);

      const flash = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flashTex, color: 0x9ffcff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      flash.position.copy(tip);
      flash.scale.setScalar(0.9);
      this.group.add(flash);
      this.flashes.push(flash);
    }
  }

  /** Trigger recoil + muzzle flash on barrel i (0 = left, 1 = right). */
  fire(i) {
    const b = this.barrels[i];
    b.position.z = b.userData.restZ + RECOIL;
    const f = this.flashes[i];
    f.material.opacity = 1;
    f.scale.setScalar(0.7 + Math.random() * 0.6);
    f.material.rotation = Math.random() * Math.PI;
  }

  /** World-space position of barrel i's tip (for spawning the tracer). */
  barrelTipWorld(i, out) {
    this.camera.updateMatrixWorld();
    return out.copy(this.tips[i]).applyMatrix4(this.camera.matrixWorld);
  }

  update(dt) {
    for (let i = 0; i < 2; i++) {
      const b = this.barrels[i];
      b.position.z += (b.userData.restZ - b.position.z) * Math.min(1, 18 * dt);
      const f = this.flashes[i];
      if (f.material.opacity > 0) f.material.opacity = Math.max(0, f.material.opacity - dt * 12);
    }
  }
}

function buildGun() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2b3346, metalness: 0.9, roughness: 0.4,
    emissive: 0x0a1a2a, emissiveIntensity: 0.6,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.8), bodyMat);
  g.add(body);

  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x161b28, metalness: 1, roughness: 0.3 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.2, 12), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.75;
  g.add(barrel);

  // glowing emitter ring at the muzzle
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.085, 0.022, 8, 18),
    new THREE.MeshBasicMaterial({ color: 0x66ffd6 })
  );
  ring.position.z = -1.3;
  g.add(ring);
  return g;
}

// Soft radial glow texture for the muzzle flash (no hard square edges).
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(190,245,255,0.85)');
  grad.addColorStop(1, 'rgba(120,210,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
