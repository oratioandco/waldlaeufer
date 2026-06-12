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
  /* schmalere Klinge; die Spitze läuft im Vertex-Shader zu */
  const blade = new THREE.PlaneGeometry(.10, .95, 1, 2);
  blade.translate(0, .475, 0);
  grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: false,
    uniforms: {
      uTime: { value: 0 },
      uColA: { value: new THREE.Vector3(.18, .40, .14) },
      uColB: { value: new THREE.Vector3(.49, .76, .30) },
      /* Licht & Nebel von der Atmosphäre – Gras leuchtet sonst
         konstant hell in der Dämmerung */
      uDim: { value: 1 },
      uFogColor: { value: new THREE.Color(0xcfe9fb) },
      uFogNear: { value: 36 },
      uFogFar: { value: 100 }
    },
    vertexShader: `
      uniform float uTime;
      varying float vH;varying float vJ;varying float vDepth;
      void main(){
        vec3 p=position;
        /* Spitze: Breite nimmt nach oben ab → Halm statt Band */
        p.x*=1.0-(position.y/0.95)*0.75;
        vec4 wp=instanceMatrix*vec4(p,1.0);
        float j=fract(sin(dot(vec2(wp.x,wp.z),vec2(12.98,78.23)))*43758.5);
        vJ=j;
        float sway=sin(uTime*1.9+wp.x*0.6+wp.z*0.8+j*6.28)*0.16*position.y;
        wp.x+=sway;wp.z+=sway*0.6;
        vH=position.y;
        vec4 mv=viewMatrix*modelMatrix*wp;
        vDepth=-mv.z;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying float vH;varying float vJ;varying float vDepth;
      uniform vec3 uColA;uniform vec3 uColB;
      uniform float uDim;uniform vec3 uFogColor;
      uniform float uFogNear;uniform float uFogFar;
      void main(){
        vec3 c=mix(uColA,uColB,clamp(vH*1.15,0.0,1.0));
        c*=(0.88+vJ*0.24)*uDim;
        float f=smoothstep(uFogNear,uFogFar,vDepth);
        c=mix(c,uFogColor,f);
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
  /* round-robin über die Segmente: senkt der AUTO-Governor die
     Instanzzahl, dünnt das Gras ÜBERALL gleichmäßig aus, statt ganze
     Bereiche schlagartig zu leeren */
  const meta = segs.map(seg => {
    const dir = seg.b.clone().sub(seg.a), len = dir.length(); dir.normalize();
    return { seg, dir, len, lat: new THREE.Vector3(-dir.z, 0, dir.x) };
  });
  const per = Math.ceil(grassMax / segs.length);
  outer:
  for (let k = 0; k < per; k++) {
    for (const { seg, dir, len, lat } of meta) {
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
export function setGrassColors(a, b) {
  if (!grassMat) return;
  grassMat.uniforms.uColA.value.set(a[0], a[1], a[2]);
  grassMat.uniforms.uColB.value.set(b[0], b[1], b[2]);
}
/* von der Atmosphäre pro Frame: Lichtfaktor + aktueller Nebel */
export function setGrassEnv(dim, fogColor, fogNear, fogFar) {
  if (!grassMat) return;
  grassMat.uniforms.uDim.value = dim;
  grassMat.uniforms.uFogColor.value.copy(fogColor);
  grassMat.uniforms.uFogNear.value = fogNear;
  grassMat.uniforms.uFogFar.value = fogFar;
}
