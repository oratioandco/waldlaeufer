/* =====================================================================
   TERRAIN + SICHTKORRIDOR
   Noise-Hügel, die rund um Pfad-Segmente und Stationslichtungen
   flach maskiert werden, damit nichts die Kamera verdeckt.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { toonMat } from '../engine/materials.js';

export function hash3(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, 0, iz), b = hash3(ix + 1, 0, iz), c = hash3(ix, 0, iz + 1), d = hash3(ix + 1, 0, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
export function fbm2(x, z) {
  let v = 0, a = .5, fx = x, fz = z;
  for (let k = 0; k < 4; k++) { v += a * vnoise2(fx, fz); fx *= 2.1; fz *= 2.1; a *= .5; }
  return v;
}
export const GLSL_NOISE = `
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float vnoise(vec3 p){
    vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){
    float v=0.0,a=0.5;
    for(int k=0;k<4;k++){v+=a*vnoise(p);p*=2.1;a*=0.5;}
    return v;
  }`;

let ground = null, groundTex = null;
export const groundCenter = new THREE.Vector3();
export let clearSegs = [];   // freizuhaltende Pfad-Segmente (inkl. letztem des Vorgebiets)
export let stationsPos = []; // Lichtungs-Zentren freihalten

export function setClearArea(segs, stations) {
  clearSegs = segs;
  stationsPos = stations;
}
export function distToClear(x, z) {
  let m = 1e9;
  const p = new THREE.Vector3(x, 0, z);
  for (const s of clearSegs) {
    const ab = s.b.clone().sub(s.a);
    const t = Math.max(0, Math.min(1, p.clone().sub(s.a).dot(ab) / ab.lengthSq()));
    m = Math.min(m, p.distanceTo(s.a.clone().addScaledVector(ab, t)));
  }
  for (const sp of stationsPos) m = Math.min(m, p.distanceTo(sp));
  return m;
}
export function hillH(x, z) {
  const mask = Math.min(1, Math.max(0, (distToClear(x, z) - 8) / 12));
  return (fbm2(x * .045, z * .045) - .45) * 4.0 * mask;
}

/* Boden-Textur aus Biom-Palette (palette[0] = Grundton, Rest = Tupfer) */
function makeGrassTex(palette) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = palette[0]; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    ctx.fillStyle = palette[1 + Math.floor(Math.random() * (palette.length - 1))];
    ctx.globalAlpha = .25 + Math.random() * .5;
    ctx.fillRect(x, y, 1.5 + Math.random() * 2.5, 1.5 + Math.random() * 2.5);
  }
  ctx.globalAlpha = 1;
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  return tx;
}
const DEFAULT_GROUND = ['#5c9c44', '#549441', '#6cae50', '#7fbe5d', '#8d9a4c'];
export function buildGround() {
  groundTex = makeGrassTex(DEFAULT_GROUND);
  const geo = new THREE.PlaneGeometry(320, 320, 90, 90);
  geo.rotateX(-Math.PI / 2);
  ground = new THREE.Mesh(geo, toonMat({ map: groundTex }));
  ground.receiveShadow = true;
  scene.add(ground);
}
export function setGroundPalette(palette) {
  if (!ground) return;
  const old = groundTex;
  groundTex = makeGrassTex(palette);
  ground.material.map = groundTex;
  ground.material.needsUpdate = true;
  if (old) old.dispose();
}
export function reshapeGround() {
  const geo = ground.geometry;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + groundCenter.x, wz = pos.getZ(i) + groundCenter.z;
    pos.setY(i, hillH(wx, wz));
    uv.setXY(i, wx * .07, wz * .07);
  }
  pos.needsUpdate = true; uv.needsUpdate = true;
  geo.computeVertexNormals();
  ground.position.set(groundCenter.x, 0, groundCenter.z);
}
