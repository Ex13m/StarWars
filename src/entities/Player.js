// Player — state only (the player is the first-person cockpit, no visible mesh).
// Shield regenerates after a quiet period; hull does not regen within a run.
import { CONFIG } from '../config.js';

export class Player {
  constructor() { this.reset(); }

  reset() {
    const p = CONFIG.player;
    this.maxShield = p.maxShield;
    this.maxHull = p.maxHull;
    this.shield = p.maxShield;
    this.hull = p.maxHull;
    this.fireTimer = 0;
    this.timeSinceHit = 99;
    this.boostTimer = 0;
    this.boostCooldownTimer = 0;
    this.iFrames = 0;
    this.alive = true;
  }

  canFire() { return this.fireTimer <= 0 && this.alive; }
  onFire() { this.fireTimer = CONFIG.player.fireCooldown; }

  update(dt) {
    this.fireTimer -= dt;
    this.timeSinceHit += dt;
    this.iFrames -= dt;
    this.boostTimer -= dt;
    this.boostCooldownTimer -= dt;

    const p = CONFIG.player;
    if (this.timeSinceHit > p.shieldRegenDelay && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + p.shieldRegenRate * dt);
    }
  }

  /** Returns true if damage was actually applied (not absorbed by i-frames). */
  takeDamage(amount) {
    if (this.iFrames > 0 || !this.alive) return false;
    this.timeSinceHit = 0;
    let dmg = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) {
      this.hull -= dmg;
      if (this.hull <= 0) { this.hull = 0; this.alive = false; }
    }
    return true;
  }

  tryBoost() {
    if (this.boostCooldownTimer > 0 || !this.alive) return false;
    const p = CONFIG.player;
    this.boostTimer = p.boostDuration;
    this.boostCooldownTimer = p.boostCooldown;
    this.iFrames = p.iFramesOnBoost;
    return true;
  }

  get boosting() { return this.boostTimer > 0; }
}
