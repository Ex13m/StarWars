// Nebula — a procedural shader nebula on a large inward-facing sphere. Additive
// blending means dark regions add nothing (so the AR camera still shows through)
// while bright cloud patches glow through the bloom. Cheap fbm noise, no textures.
import * as THREE from 'three';

export class Nebula {
  constructor(scene, intensity = 0.4) {
    const geo = new THREE.SphereGeometry(900, 32, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0x2a6cff) }, // cool blue
        uColorB: { value: new THREE.Color(0xff3d7a) }, // warm magenta
        uIntensity: { value: intensity },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vDir;
        uniform float uTime;
        uniform float uIntensity;
        uniform vec3 uColorA;
        uniform vec3 uColorB;

        // iq-style value noise
        float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0;
          return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float noise(vec3 x){
          vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                         mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                         mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        float fbm(vec3 p){ float v=0.0, a=0.5;
          for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; } return v; }

        void main(){
          vec3 dir = normalize(vDir);
          float drift = uTime * 0.02;
          float clouds = smoothstep(0.45, 0.95, fbm(dir*3.0 + vec3(0.0,0.0,drift)));
          vec3 col = mix(uColorA, uColorB, fbm(dir*2.0 + 10.0));
          gl_FragColor = vec4(col * clouds * uIntensity, 1.0);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.mat = mat;
  }

  update(dt) {
    this.mat.uniforms.uTime.value += dt;
    this.mesh.rotation.y += dt * 0.003;
  }
}
