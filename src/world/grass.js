/* ---------- Instanziertes Shader-Gras mit Wind-Sway ---------- */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { QUALITY, qTier } from '../engine/quality.js';
import { hash3, hillH } from './terrain.js';

export let grassMesh = null;
let grassMat = null;
const grassMax = 9000;
let placed = 0;
export function grassPlaced() { return placed; }

export function buildGrass() {
  const blade = new THREE.PlaneGeometry(.14, .95, 1, 2);
  blade.translate(0, .475, 0);
  grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying float vH;varying float vJ;
      void main(){
        vec4 wp=instanceMatrix*vec4(position,1.0);
        float j=fract(sin(dot(vec2(wp.x,wp.z),vec2(12.98,78.23)))*43758.5);
        vJ=j;
        float sway=sin(uTime*1.9+wp.x*0.6+wp.z*0.8+j*6.28)*0.16*position.y;
        wp.x+=sway;wp.z+=sway*0.6;
        vH=position.y;
        gl_Position=projectionMatrix*viewMatrix*modelMatrix*wp;
      }`,
    fragmentShader: `
      varying float vH;varying float vJ;
      void main(){
        vec3 a=vec3(0.18,0.40,0.14);
        vec3 b=vec3(0.49,0.76,0.30);
        vec3 c=mix(a,b,clamp(vH*1.15,0.0,1.0));
        c*=0.88+vJ*0.24;
        gl_FragColor=vec4(c,1.0);
      }`
  });
  grassMesh = new THREE.InstancedMesh(blade, grassMat, grassMax);
  grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  grassMesh.frustumCulled = false;
  scene.add(grassMesh);
}
export function scatterGrass(segs) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  let i = 0;
  outer:
  for (const seg of segs) {
    const dir = seg.b.clone().sub(seg.a), len = dir.length(); dir.normalize();
    const lat = new THREE.Vector3(-dir.z, 0, dir.x);
    const per = Math.ceil(grassMax / segs.length);
    for (let k = 0; k < per; k++) {
      if (i >= grassMax) break outer;
      const d = hash3(i, 1, 2) * len;
      const side = hash3(i, 3, 4) < .5 ? -1 : 1;
      const off = 1.4 + Math.pow(hash3(i, 5, 6), 0.7) * 15;
      const p = seg.a.clone().addScaledVector(dir, d).addScaledVector(lat, side * off);
      const y = hillH(p.x, p.z);
      e.set((hash3(i, 7, 8) - .5) * .3, hash3(i, 9, 10) * 6.28, (hash3(i, 11, 12) - .5) * .3);
      q.setFromEuler(e);
      const sc = .7 + hash3(i, 13, 14) * .9;
      s.set(sc, sc, sc);
      m.compose(new THREE.Vector3(p.x, y, p.z), q, s);
      grassMesh.setMatrixAt(i, m);
      i++;
    }
  }
  placed = i;
  grassMesh.count = Math.min(i, QUALITY[qTier].grass);
  grassMesh.instanceMatrix.needsUpdate = true;
}
export function updateGrass(time) {
  if (grassMat) grassMat.uniforms.uTime.value = time;
}
