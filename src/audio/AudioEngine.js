// AudioEngine — real-asset audio via Howler.js (vendored global window.Howl).
//
// Design:
//  - SFX are grouped; each group has several takes. We round-robin/randomise takes
//    so repeated shots/explosions never sound like a copy-paste machine gun (a
//    standard AAA trick).
//  - Optional 3D positioning: pass a THREE.Vector3-ish {x,y,z} and the sound pans
//    from that direction. The listener (camera) is updated each frame.
//  - Music plays in layers (briefing / combat / boss) and crossfades between them.
//  - A looping engine hum tracks flight speed (volume + pitch).
//
// Everything degrades to silence if Howler is missing — never throws.

import { CONFIG } from '../config.js';

const BASE = './assets/audio';

// group -> list of files (relative to BASE/sfx). Multiple takes = variety.
const SFX = {
  laserPlayer: ['laser_small_000', 'laser_small_001', 'laser_small_004'],
  laserEnemy: ['laser_large_000', 'laser_large_002'],
  laserHeavy: ['laser_retro_000'],
  explosion: ['explosion_crunch_000', 'explosion_crunch_001', 'explosion_crunch_002', 'explosion_crunch_003'],
  explosionBig: ['low_frequency_explosion_000', 'low_frequency_explosion_001'],
  impact: ['impact_metal_000', 'impact_metal_001', 'impact_metal_002', 'impact_metal_003'],
  shield: ['force_field_000', 'force_field_001'],
  thruster: ['thruster_fire_000'],
  ui: ['computer_noise_000', 'computer_noise_002'],
};

const MUSIC = {
  briefing: 'briefing.mp3',
  combat: 'combat.mp3',
  boss: 'boss.mp3',
};

export class AudioEngine {
  constructor() {
    this.ok = typeof window !== 'undefined' && typeof window.Howl === 'function';
    this.sfx = {};        // group -> Howl[]
    this.rr = {};         // group -> last index (round-robin)
    this.music = {};      // key -> Howl
    this.currentMusic = null;
    this.engine = null;   // looping engine hum Howl
    this.unlocked = false;
  }

  // Build all Howls. Cheap: Howler streams/decodes lazily on first play.
  preload() {
    if (!this.ok) return;
    const { Howl } = window;

    for (const [group, files] of Object.entries(SFX)) {
      this.sfx[group] = files.map(
        (f) => new Howl({ src: [`${BASE}/sfx/${f}.ogg`], volume: CONFIG.audio.sfxVolume })
      );
      this.rr[group] = -1;
    }

    for (const [key, file] of Object.entries(MUSIC)) {
      this.music[key] = new Howl({
        src: [`${BASE}/music/${file}`],
        loop: true,
        volume: 0,
        html5: true, // stream long tracks instead of fully decoding into memory
      });
    }

    this.engine = new Howl({
      src: [`${BASE}/sfx/engine_circular_000.ogg`],
      loop: true,
      volume: 0,
    });
  }

  // Must be called from a user gesture (e.g. ENGAGE click) to satisfy autoplay rules.
  unlock() {
    if (!this.ok || this.unlocked) return;
    this.unlocked = true;
    if (window.Howler) window.Howler.volume(CONFIG.audio.masterVolume);
    if (this.engine && !this.engine.playing()) this.engine.play();
  }

  /** Play one take from a group. opts: { pos:{x,y,z}, volume, rate } */
  play(group, opts = {}) {
    if (!this.ok) return;
    const takes = this.sfx[group];
    if (!takes || takes.length === 0) return;

    // Round-robin with a little randomness so it never feels mechanical.
    let i = this.rr[group];
    i = takes.length === 1 ? 0 : (i + 1 + ((Math.random() * (takes.length - 1)) | 0)) % takes.length;
    this.rr[group] = i;

    const howl = takes[i];
    const id = howl.play();
    if (opts.volume != null) howl.volume(opts.volume, id);
    // Slight pitch variation adds life to repeated SFX.
    howl.rate(opts.rate != null ? opts.rate : 0.94 + Math.random() * 0.12, id);
    if (opts.pos) howl.pos(opts.pos.x, opts.pos.y, opts.pos.z, id);
    return id;
  }

  /** Crossfade to a music layer: 'briefing' | 'combat' | 'boss'. */
  setMusic(key) {
    if (!this.ok || this.currentMusic === key) return;
    const ms = CONFIG.audio.musicCrossfadeMs;
    const next = this.music[key];
    const prev = this.currentMusic ? this.music[this.currentMusic] : null;

    if (next) {
      if (!next.playing()) next.play();
      next.fade(next.volume(), CONFIG.audio.musicVolume, ms);
    }
    if (prev && prev !== next) {
      prev.fade(prev.volume(), 0, ms);
      setTimeout(() => prev.stop(), ms + 50);
    }
    this.currentMusic = key;
  }

  /** Update the looping engine hum from current flight speed (0..1 normalised). */
  setEngine(speed01) {
    if (!this.ok || !this.engine) return;
    const v = CONFIG.audio.engineVolume * (0.35 + 0.65 * speed01);
    this.engine.volume(v);
    this.engine.rate(0.8 + 0.7 * speed01);
  }

  /** Keep the spatial listener in sync with the camera each frame. */
  updateListener(camera) {
    if (!this.ok || !window.Howler || !window.Howler.pos) return;
    const p = camera.position;
    window.Howler.pos(p.x, p.y, p.z);
    // forward + up vectors from the camera's world matrix.
    const e = camera.matrixWorld.elements;
    window.Howler.orientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
  }

  stopAll() {
    if (!this.ok) return;
    if (window.Howler) window.Howler.stop();
    this.currentMusic = null;
  }
}
