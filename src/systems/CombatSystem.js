// CombatSystem — the heart of the fight. Owns the projectile + explosion pools,
// fires player/enemy weapons, resolves collisions and damage, and triggers the
// "juice": SFX, explosions, haptics and camera kicks (via hooks).
//
// Collision is simple sphere tests against the player (origin) and each enemy.
// Counts are small, so O(projectiles × enemies) is fine and keeps the code clear.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ProjectilePool } from '../entities/Projectile.js';
import { ExplosionPool } from '../entities/Explosion.js';

export class CombatSystem {
  constructor(scene, { player, score, audio, hooks }) {
    this.projectiles = new ProjectilePool(scene);
    this.explosions = new ExplosionPool(scene);
    this.player = player;
    this.score = score;
    this.audio = audio;
    this.hooks = hooks || {};

    // scratch (no per-frame allocation)
    this._fwd = new THREE.Vector3();
    this._toE = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
  }

  /**
   * Write the firing direction (crosshair forward + light aim assist) into `out`.
   * Caller owns the spawn so it can fire from the visible gun barrels.
   */
  aimDir(out, camera, enemies) {
    out.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const a = CONFIG.aim;
    let best = null;
    let bestDot = Math.cos(a.assistCone);
    for (const e of enemies) {
      if (!e.active) continue;
      this._toE.copy(e.position).sub(camera.position);
      const dist = this._toE.length();
      if (dist > a.range || dist < 0.001) continue;
      this._toE.multiplyScalar(1 / dist);
      const dot = this._toE.dot(out);
      if (dot > bestDot) { bestDot = dot; best = e; }
    }
    if (best) {
      this._dir.copy(best.position).sub(camera.position).normalize();
      out.lerp(this._dir, a.assistStrength).normalize();
    }
    return out;
  }

  /** Spawn one player bolt from a world-space barrel tip. */
  spawnPlayerBolt(origin, dir) {
    const p = CONFIG.player;
    this.projectiles.spawn(origin, dir, p.projectileSpeed, 'player', p.projectileDamage);
  }

  /** Enemy fires a bolt straight at the player (origin). Called by EnemyAI. */
  enemyFire(enemy) {
    this._dir.copy(enemy.position).multiplyScalar(-1).normalize(); // toward origin
    const e = CONFIG.enemy;
    this.projectiles.spawn(enemy.position, this._dir, e.projectileSpeed, 'enemy', e.projectileDamage);
    this.audio.play('laserEnemy', { pos: enemy.position });
  }

  update(dt, enemies, camera) {
    this.projectiles.update(dt);
    this.explosions.update(dt, camera);

    const pr2 = CONFIG.player.hitRadius * CONFIG.player.hitRadius;

    // --- projectile collisions ---
    for (const p of this.projectiles.items) {
      if (!p.active) continue;

      if (p.team === 'player') {
        for (const e of enemies) {
          if (!e.active) continue;
          const rr = e.radius + p.radius;
          if (e.position.distanceToSquared(p.mesh.position) < rr * rr) {
            const dead = e.damage(p.damage);
            this.projectiles.kill(p);
            this.audio.play('impact', { pos: p.mesh.position });
            if (dead) this._killEnemy(e, false);
            break;
          }
        }
      } else {
        // enemy bolt vs player at the origin
        if (p.mesh.position.lengthSq() < pr2) {
          const applied = this.player.takeDamage(p.damage);
          this.projectiles.kill(p);
          if (applied) this._onPlayerHit(false);
        }
      }
    }

    // --- enemy body contact + fly-past despawn ---
    const despawn2 = CONFIG.enemy.despawnDistance * CONFIG.enemy.despawnDistance;
    for (const e of enemies) {
      if (!e.active) continue;
      const d2 = e.position.lengthSq();
      const cr = e.radius + CONFIG.player.hitRadius;
      if (d2 < cr * cr) {
        const applied = this.player.takeDamage(CONFIG.enemy.contactDamage);
        this._explode(e, 0xff8a5c);
        e.kill();
        if (applied) this._onPlayerHit(true);
      } else if (d2 > despawn2) {
        e.kill(); // flew past — no penalty, no points
      }
    }
  }

  _killEnemy(e, fromContact) {
    this._explode(e, e.type === 'boss' ? 0xff7849 : 0xffd27f);
    this.score.addKill(e.points);
    vibrate(CONFIG.weaponFeel.haptics.explosion);
    e.kill();
  }

  _explode(e, color) {
    const big = e.type === 'boss' || e.type === 'bomber';
    this.explosions.spawn(e.position, e.radius * (big ? 1.0 : 0.7), color);
    this.audio.play(big ? 'explosionBig' : 'explosion', { pos: e.position });
  }

  _onPlayerHit(contact) {
    this.score.registerPlayerHit();
    this.audio.play(this.player.shield > 0 ? 'shield' : 'impact');
    vibrate(CONFIG.weaponFeel.haptics.hit);
    if (this.hooks.onPlayerHit) this.hooks.onPlayerHit(contact);
  }

  reset() {
    for (const p of this.projectiles.items) this.projectiles.kill(p);
  }
}

function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}
