// EnemyAI — per-enemy behaviour. The player sits at the origin; enemies approach
// from the streaming corridor ahead and to the sides, then strafe and fire.
//
//  - scout  : kamikaze ram (no guns) — accelerates straight at the player.
//  - bomber : slow, heavy ram with occasional heavy shots.
//  - interceptor: keeps a stand-off distance, strafes sideways, fires bursts.
//  - boss   : hovers at range, strafes slowly, fires steadily.
//
// Stateless function + caller-provided scratch vectors = no per-frame allocation.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const ORIGIN = new THREE.Vector3(0, 0, 0);

export function updateEnemyAI(enemy, ctx, dt) {
  enemy.stateTime += dt;

  const toPlayer = ctx.tmpDir.copy(ORIGIN).sub(enemy.position);
  const dist = toPlayer.length();
  if (dist > 0.0001) toPlayer.multiplyScalar(1 / dist); // normalize

  const rams = enemy.type === 'scout' || enemy.type === 'bomber';
  const isBoss = enemy.type === 'boss';
  const standoff = rams ? 0 : (isBoss ? 42 : 26);

  // Boss escalates with its HP phase: faster strafe, faster fire, wider volley.
  let phase = 1, speedMul = 1, fireMul = 1;
  if (isBoss) {
    phase = enemy.bossPhase();
    speedMul = CONFIG.boss.speedMul[phase - 1];
    fireMul = CONFIG.boss.fireMul[phase - 1];
  }

  if (rams) {
    // Ramming types just bee-line in, scouts accelerating as they close.
    const accel = enemy.type === 'scout' ? 1.5 : 1.0;
    enemy.vel.copy(toPlayer).multiplyScalar(enemy.speed * accel);
  } else if (dist > standoff + 5) {
    // Close the gap.
    enemy.vel.copy(toPlayer).multiplyScalar(enemy.speed * speedMul);
  } else {
    // In range: strafe perpendicular to the line of sight, easing in/out, with a
    // gentle inward bias so they orbit rather than drift away.
    const perp = ctx.tmpPerp.crossVectors(toPlayer, ctx.up).normalize();
    const sway = Math.sin(enemy.stateTime * 1.3 + enemy.fireTimer);
    enemy.vel.copy(perp).multiplyScalar(enemy.speed * speedMul * sway);
    enemy.vel.addScaledVector(toPlayer, enemy.speed * 0.12);

    // Fire toward the player while in range.
    if (enemy.fireRate > 0) {
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = 1 / (enemy.fireRate * fireMul);
        if (isBoss) ctx.fireSpread(enemy, CONFIG.boss.spreadByPhase[phase - 1], CONFIG.boss.spreadAngle);
        else ctx.fireAt(enemy);
      }
    }
  }

  // Always face the player.
  enemy.group.lookAt(ORIGIN);
  enemy.integrate(dt);
}
