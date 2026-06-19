// Postprocessing — EffectComposer with UnrealBloom for the HDR glow that makes
// lasers, explosions and warp-streaks bloom like a cinematic space battle.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CONFIG } from '../config.js';

export class Postprocessing {
  constructor(renderer, scene, camera) {
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const b = CONFIG.render.bloom;
    this.bloom = new UnrealBloomPass(size, b.strength, b.radius, b.threshold);
    this.composer.addPass(this.bloom);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
  }

  render() {
    this.composer.render();
  }
}
