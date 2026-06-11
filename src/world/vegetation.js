/* ---------- Vegetation & Dekor (Low-Poly, prozedural deformiert) ---------- */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { glowSprite, blobShadow, glowTex } from '../engine/textures.js';
import { camPos } from '../engine/camera.js';
import { hash3 } from './terrain.js';

export const COLORS = [
  { name: 'rote',  hex: 0xff4d5e }, { name: 'blaue', hex: 0x3a8bff }, { name: 'grüne', hex: 0x35c468 },
  { name: 'gelbe', hex: 0xffd34a }, { name: 'lila',  hex: 0xb266ff }
];

/* Dekor, das auf NIEDRIG ausgeblendet wird */
export const extraDecor = [];

function deformGeo(geo, roughAmt) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = hash3(Math.round(x * 5) / 5, Math.round(y * 5) / 5, Math.round(z * 5) / 5);
    const sc = 1 + (n - .5) * roughAmt;
    pos.setXYZ(i, x * sc, y * sc, z * sc);
  }
  geo.computeVertexNormals();
  return geo;
}
function castAll(grp) { grp.traverse(o => { if (o.isMesh) o.castShadow = true; }); }

export function makeTree(seed) {
  const grp = new THREE.Group();
  const pine = hash3(seed, 1, 1) < .4;
  const trunkH = pine ? 1.7 : 1.5 + hash3(seed, 2, 2) * 1.3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.17, .3, trunkH, 7),
    new THREE.MeshLambertMaterial({ color: 0x6e4b2a }));
  trunk.position.y = trunkH / 2; grp.add(trunk);
  if (pine) {
    const c = new THREE.Color().setHSL(.36, .5, .27 + hash3(seed, 3, 3) * .08);
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(deformGeo(new THREE.ConeGeometry(1.6 - k * .42, 1.6, 9), .14),
        new THREE.MeshLambertMaterial({ color: c }));
      cone.position.y = trunkH + .55 + k * 1.05;
      grp.add(cone);
    }
  } else {
    const c = new THREE.Color().setHSL(.3 + hash3(seed, 4, 4) * .08, .55, .38 + hash3(seed, 5, 5) * .1);
    const n = 2 + Math.floor(hash3(seed, 6, 6) * 2);
    for (let k = 0; k < n; k++) {
      const ball = new THREE.Mesh(deformGeo(new THREE.IcosahedronGeometry(1.2 + hash3(seed, k, 7) * .8, 2), .32),
        new THREE.MeshLambertMaterial({ color: c.clone().offsetHSL(0, 0, (hash3(seed, k, 8) - .5) * .08) }));
      ball.position.set((hash3(seed, k, 9) - .5) * 1.5, trunkH + .9 + hash3(seed, k, 10) * 1.3, (hash3(seed, k, 11) - .5) * 1.5);
      grp.add(ball);
    }
  }
  castAll(grp);
  grp.scale.setScalar(.85 + hash3(seed, 12, 12) * .75);
  return grp;
}
export function makeBush(seed) {
  const grp = new THREE.Group();
  const c = new THREE.Color().setHSL(.32, .5, .32 + hash3(seed, 1, 2) * .1);
  const b = new THREE.Mesh(deformGeo(new THREE.IcosahedronGeometry(.75, 2), .4),
    new THREE.MeshLambertMaterial({ color: c }));
  b.position.y = .55; b.castShadow = true; grp.add(b);
  return grp;
}
export function makeStone(seed) {
  const m = new THREE.Mesh(deformGeo(new THREE.IcosahedronGeometry(.4 + hash3(seed, 1, 1) * .7, 1), .6),
    new THREE.MeshLambertMaterial({ color: 0x9aa3a8 }));
  m.position.y = .25; m.castShadow = true;
  return m;
}
export function makeFlowerPatch(seed) {
  const grp = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const c = COLORS[Math.floor(hash3(seed, k, 3) * COLORS.length)].hex;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 5),
      new THREE.MeshLambertMaterial({ color: c }));
    head.position.set((hash3(seed, k, 4) - .5) * .7, .34, (hash3(seed, k, 5) - .5) * .7);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .3, 4),
      new THREE.MeshLambertMaterial({ color: 0x3f7d33 }));
    stem.position.set(head.position.x, .16, head.position.z);
    grp.add(stem); grp.add(head);
  }
  return grp;
}
export function makeBigFlower(colorDef, seed) {
  const grp = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x3f7d33 }));
  stem.position.y = .8; grp.add(stem);
  const center = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xffe9a3 }));
  center.position.y = 1.7; grp.add(center);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.ConeGeometry(.22, .8, 5),
      new THREE.MeshLambertMaterial({ color: colorDef.hex }));
    petal.position.set(Math.cos(a) * .52, 1.7, Math.sin(a) * .52);
    petal.lookAt(Math.cos(a) * 3, 1.7, Math.sin(a) * 3);
    petal.rotateX(Math.PI / 2);
    grp.add(petal);
  }
  const gl = glowSprite(colorDef.hex, 2.6); gl.position.y = 1.7; gl.material.opacity = .45;
  grp.add(gl);
  castAll(grp);
  grp.add(blobShadow(1.8));
  grp.userData.headY = 1.7;
  return grp;
}

/* ---------- Pollen-Partikel ---------- */
export let pollenPts = null;
let pollenGrp = null;

export function buildPollen() {
  pollenGrp = new THREE.Group(); scene.add(pollenGrp);
  const N = 90, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = -16 + Math.random() * 32; pos[i * 3 + 1] = .5 + Math.random() * 7; pos[i * 3 + 2] = -24 + Math.random() * 34;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pollenPts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xfff8d0, size: .12, transparent: true, opacity: .75,
    blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex }));
  pollenPts.userData.seed = seed;
  pollenGrp.add(pollenPts);
}
export function updatePollen(time, dt) {
  if (pollenGrp) { pollenGrp.position.x = camPos.x; pollenGrp.position.z = camPos.z; }
  if (pollenPts && pollenPts.visible) {
    const arr = pollenPts.geometry.attributes.position.array;
    const sd = pollenPts.userData.seed;
    for (let i = 0; i < sd.length; i++) {
      arr[i * 3] += Math.sin(time * .6 + sd[i]) * dt * .5;
      arr[i * 3 + 1] += Math.cos(time * .4 + sd[i]) * dt * .3;
      if (arr[i * 3 + 1] < .3) arr[i * 3 + 1] = 6;
      if (arr[i * 3 + 1] > 7.5) arr[i * 3 + 1] = .5;
    }
    pollenPts.geometry.attributes.position.needsUpdate = true;
  }
}
