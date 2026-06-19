// Armada — the large-scale battle you fly THROUGH. Non-interactive set dressing
// that sells "you are in the middle of a massive fleet engagement":
//   - capital ships (huge hulls with engine glow + running lights), drifting
//   - a swarm of distant fighters (moving specks) dogfighting
//   - tracer streaks between them (far-off weapons fire)
//   - flak: distant explosion flashes popping across the field
//
// Everything streams toward the camera (+Z) at a flow speed set by Game, so when
// you throttle up the whole battle rushes past. Parallax: capitals drift slower.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const FRIENDLY = 0x6fd0ff;
const HOSTILE = 0xff5a6e;
const NEAR_Z = 70; // recycle once something passes this far behind the camera

export class Armada {
  constructor(scene) {
    this.cfg = CONFIG.armada;
    this.flow = CONFIG.flight.cruiseSpeed;
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildCapitalShips();
    this._buildSwarm();
    this._buildTracers();
    this._buildFlak();
    this._flakTimer = 0;
    this._tmp = new THREE.Vector3();
  }

  setFlow(speed) { this.flow = speed; }

  // --- capital ships ---
  _buildCapitalShips() {
    this.capitals = [];
    for (let i = 0; i < this.cfg.capitalShips; i++) {
      const friendly = i % 2 === 0;
      const ship = this._buildCapital(friendly);
      this._placeCapital(ship, true);
      this.group.add(ship);
      this.capitals.push(ship);
    }
  }

  _buildCapital(friendly) {
    const g = new THREE.Group();
    const len = 36 + Math.random() * 60;
    const hullMat = new THREE.MeshStandardMaterial({
      color: friendly ? 0x33415c : 0x3a2540,
      metalness: 0.85, roughness: 0.5,
      emissive: friendly ? 0x0b1e36 : 0x2a0c33, emissiveIntensity: 0.4,
    });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(len * 0.18, len * 0.12, len), hullMat);
    g.add(hull);
    // a couple of greeble blocks for silhouette
    for (let k = 0; k < 3; k++) {
      const gb = new THREE.Mesh(new THREE.BoxGeometry(len * 0.1, len * 0.08, len * 0.2), hullMat);
      gb.position.set((Math.random() - 0.5) * len * 0.12, len * 0.07, (Math.random() - 0.5) * len * 0.6);
      g.add(gb);
    }
    // engine glow at the stern
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(len * 0.07, 16),
      new THREE.MeshBasicMaterial({ color: friendly ? 0x7fe3ff : 0xff7a5c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.position.z = len * 0.5;
    g.add(glow);
    // running lights along the hull
    const lightColor = friendly ? FRIENDLY : HOSTILE;
    for (let k = 0; k < 6; k++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(len * 0.012, 6, 6),
        new THREE.MeshBasicMaterial({ color: lightColor })
      );
      dot.position.set((Math.random() - 0.5) * len * 0.16, (Math.random() - 0.5) * len * 0.1, (Math.random() - 0.5) * len * 0.9);
      g.add(dot);
    }
    g.userData.len = len;
    g.rotation.y = (Math.random() - 0.5) * 0.6;
    g.rotation.z = (Math.random() - 0.5) * 0.3;
    return g;
  }

  _placeCapital(ship, spread) {
    const c = this.cfg;
    const ang = Math.random() * Math.PI * 2;
    const rad = (0.35 + Math.random() * 0.65) * c.swarmRadius;
    ship.position.set(Math.cos(ang) * rad, (Math.random() - 0.5) * c.swarmRadius * 0.5, spread ? -Math.random() * c.corridorDepth : -c.corridorDepth);
  }

  // --- fighter swarm (moving specks) ---
  _buildSwarm() {
    const n = this.cfg.fighterSwarm;
    this.swarmPos = new Float32Array(n * 3);
    this.swarmVel = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const cF = new THREE.Color(FRIENDLY);
    const cH = new THREE.Color(HOSTILE);
    for (let i = 0; i < n; i++) {
      this._respawnFighter(i, true);
      const c = Math.random() < 0.5 ? cF : cH;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.swarmPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.swarmGeo = geo;
    const mat = new THREE.PointsMaterial({
      size: 1.4, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    this.swarm = new THREE.Points(geo, mat);
    this.swarm.frustumCulled = false;
    this.group.add(this.swarm);
  }

  _respawnFighter(i, spread) {
    const c = this.cfg;
    const ang = Math.random() * Math.PI * 2;
    const minF = c.swarmMinRadiusFrac;
    const rad = (minF + Math.random() * (1 - minF)) * c.swarmRadius;
    this.swarmPos[i * 3] = Math.cos(ang) * rad;
    this.swarmPos[i * 3 + 1] = Math.sin(ang) * rad * 0.7;
    this.swarmPos[i * 3 + 2] = spread ? -Math.random() * c.corridorDepth : -c.corridorDepth;
    // small lateral jitter so they weave like dogfighters
    this.swarmVel[i * 3] = (Math.random() - 0.5) * 6;
    this.swarmVel[i * 3 + 1] = (Math.random() - 0.5) * 6;
    this.swarmVel[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }

  // --- tracer streaks (far-off weapons fire) ---
  _buildTracers() {
    this.tracerCount = 16;
    this.tracerPos = new Float32Array(this.tracerCount * 2 * 3);
    this.tracerLife = new Float32Array(this.tracerCount);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    this.tracerGeo = geo;
    // Cool, faint streaks so distant fire never gets mistaken for incoming bolts.
    const mat = new THREE.LineBasicMaterial({
      color: 0x8fb4ff, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.tracers = new THREE.LineSegments(geo, mat);
    this.tracers.frustumCulled = false;
    this.group.add(this.tracers);
  }

  _spawnTracer() {
    // pick a dead tracer slot and lay it between two random nearby swarm fighters
    let slot = -1;
    for (let i = 0; i < this.tracerCount; i++) if (this.tracerLife[i] <= 0) { slot = i; break; }
    if (slot < 0) return;
    const n = this.cfg.fighterSwarm;
    const a = (Math.random() * n) | 0;
    const o = slot * 6;
    const ax = this.swarmPos[a * 3], ay = this.swarmPos[a * 3 + 1], az = this.swarmPos[a * 3 + 2];
    this.tracerPos[o] = ax; this.tracerPos[o + 1] = ay; this.tracerPos[o + 2] = az;
    this.tracerPos[o + 3] = ax + (Math.random() - 0.5) * 40;
    this.tracerPos[o + 4] = ay + (Math.random() - 0.5) * 40;
    this.tracerPos[o + 5] = az - 20 - Math.random() * 50;
    this.tracerLife[slot] = 0.12 + Math.random() * 0.12;
  }

  // --- flak (distant explosions) ---
  _buildFlak() {
    this.flak = [];
    const tex = glowTexture();
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0xffaa00, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      s.visible = false;
      this.group.add(s);
      this.flak.push({ sprite: s, life: 0, dur: 0.8 });
    }
  }

  _spawnFlak() {
    const f = this.flak.find((x) => x.life <= 0);
    if (!f) return;
    const c = this.cfg;
    const ang = Math.random() * Math.PI * 2;
    const rad = (0.3 + Math.random() * 0.7) * c.swarmRadius;
    f.sprite.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.7, -150 - Math.random() * (c.corridorDepth - 150));
    f.sprite.material.color.setHex(Math.random() < 0.5 ? 0xffae5c : 0xff6a4c);
    f.life = f.dur;
  }

  update(dt) {
    const c = this.cfg;

    // capitals drift slowly (parallax) toward the camera
    const capFlow = this.flow * 0.25;
    for (const ship of this.capitals) {
      ship.position.z += capFlow * dt;
      ship.rotation.z += dt * 0.02;
      if (ship.position.z > NEAR_Z + ship.userData.len) this._placeCapital(ship, false);
    }

    // swarm streams faster + weaves
    const n = c.fighterSwarm;
    for (let i = 0; i < n; i++) {
      this.swarmPos[i * 3] += this.swarmVel[i * 3] * dt;
      this.swarmPos[i * 3 + 1] += this.swarmVel[i * 3 + 1] * dt;
      this.swarmPos[i * 3 + 2] += (this.flow + this.swarmVel[i * 3 + 2]) * dt;
      if (this.swarmPos[i * 3 + 2] > NEAR_Z) this._respawnFighter(i, false);
    }
    this.swarmGeo.attributes.position.needsUpdate = true;

    // tracers: occasionally spawn, always fade + scroll with the flow
    if (Math.random() < dt * 22) this._spawnTracer();
    for (let i = 0; i < this.tracerCount; i++) {
      if (this.tracerLife[i] <= 0) continue;
      this.tracerLife[i] -= dt;
      const o = i * 6;
      const dz = this.flow * dt;
      this.tracerPos[o + 2] += dz; this.tracerPos[o + 5] += dz;
      if (this.tracerLife[i] <= 0) { // collapse the segment so it disappears
        this.tracerPos[o + 3] = this.tracerPos[o];
        this.tracerPos[o + 4] = this.tracerPos[o + 1];
        this.tracerPos[o + 5] = this.tracerPos[o + 2];
      }
    }
    this.tracerGeo.attributes.position.needsUpdate = true;

    // flak explosions
    this._flakTimer -= dt;
    if (this._flakTimer <= 0) { this._spawnFlak(); this._flakTimer = c.flakInterval * (0.5 + Math.random()); }
    for (const f of this.flak) {
      if (f.life <= 0) continue;
      f.life -= dt;
      f.sprite.position.z += this.flow * dt;
      const t = 1 - f.life / f.dur;
      f.sprite.material.opacity = Math.max(0, 1 - t);
      f.sprite.scale.setScalar(6 + t * 28);
      f.sprite.visible = f.life > 0;
    }
  }
}

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,200,130,0.85)');
  grad.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
