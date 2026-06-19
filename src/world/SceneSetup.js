// SceneSetup — scene-level atmosphere: lights + fog. Kept tiny on purpose.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function setupScene(scene) {
  // Cool ambient + a key rim light give ships readable shading against space.
  scene.add(new THREE.AmbientLight(0x223355, 1.4));

  const key = new THREE.DirectionalLight(0xbfe0ff, 1.6);
  key.position.set(3, 4, 2);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x4466ff, 0.8);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  // Distance fog fades streaks/enemies in from the deep — adds depth, hides spawn pop.
  scene.fog = new THREE.FogExp2(0x05070f, 1 / CONFIG.render.far * 1.6);
  return scene;
}
