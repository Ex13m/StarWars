// ScoreSystem — score, combo multiplier and persistent high score.
// Combo grows with a kill streak and decays if you stop killing; taking a hit
// resets it. High score lives in localStorage.
import { CONFIG } from '../config.js';

const HS_KEY = 'starwars.highscore';
const COMBO_WINDOW = 4.0; // seconds before the streak starts to lapse

export class ScoreSystem {
  constructor() {
    this.score = 0;
    this.streak = 0;
    this.comboTimer = 0;
    this.best = this._loadBest();
  }

  get multiplier() {
    return Math.min(8, 1 + Math.floor(this.streak / 4));
  }

  addKill(points) {
    this.score += Math.round(points * this.multiplier);
    this.streak += 1;
    this.comboTimer = COMBO_WINDOW;
  }

  registerPlayerHit() {
    this.streak = 0;
    this.comboTimer = 0;
  }

  update(dt) {
    if (this.streak > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        // lapse one tier at a time rather than dropping to zero instantly
        this.streak = Math.max(0, this.streak - 2);
        this.comboTimer = this.streak > 0 ? COMBO_WINDOW : 0;
      }
    }
  }

  commitBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem(HS_KEY, String(this.best)); } catch { /* ignore */ }
      return true;
    }
    return false;
  }

  reset() {
    this.score = 0;
    this.streak = 0;
    this.comboTimer = 0;
  }

  _loadBest() {
    try { return parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0; }
    catch { return 0; }
  }
}
