/* ---------- Vegetation & Dekor ----------
   Professionelle CC0-Assets (Quaternius Ultimate Stylized Nature,
   konvertiert nach GLB) je Biom; prozedurale Formen nur noch als
   Fallback, solange die Modelle laden. ---------- */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from '../engine/renderer.js';
import { glowSprite, blobShadow, glowTex } from '../engine/textures.js';
import { camPos } from '../engine/camera.js';
import { hash3 } from './terrain.js';

export { COLORS } from './colors.js';
import { COLORS } from './colors.js';
import { toonMat } from '../engine/materials.js';

/* ---------- Natur-Asset-Bibliothek ---------- */
const NATURE = {};
const NATURE_KEYS = [
  'NormalTree_1', 'NormalTree_2', 'BirchTree_1', 'BirchTree_2',
  'MapleTree_1', 'MapleTree_2', 'PineTree_1', 'PineTree_2',
  'DeadTree_1', 'DeadTree_2', 'Bush', 'Bush_Large', 'Grass_Large',
  'Rock_1', 'Rock_2', 'Rock_3', 'Flower_1_Clump', 'Flower_3_Clump'
];
/* Grundskalierung je Modellfamilie (nach Sichtung feinjustieren) */
const NATURE_SCALE = { Tree: 1, Dead: 1, Bush: 1, Grass: 1, Rock: 1, Flower: 1 };
function familyScale(key) {
  if (key.includes('Rock')) return NATURE_SCALE.Rock;
  if (key.includes('Bush')) return NATURE_SCALE.Bush;
  if (key.includes('Grass')) return NATURE_SCALE.Grass;
  if (key.includes('Flower')) return NATURE_SCALE.Flower;
  if (key.includes('Dead')) return NATURE_SCALE.Dead;
  return NATURE_SCALE.Tree;
}
export function loadNature() {
  const loader = new GLTFLoader();
  return Promise.all(NATURE_KEYS.map(k => new Promise(res => {
    loader.load(`/assets/models/nature/${k}.glb`, g => {
      g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
      NATURE[k] = g.scene;
      res();
    }, undefined, () => res()); /* Fehler → prozeduraler Fallback bleibt */
  })));
}
/* Die GLBs kommen ohne Texturen, aber mit sprechenden Material-Namen
   (BirchTree_Bark, _Leaves, Rock …). Wir mappen Namen → Toon-Farben,
   LAUB bekommt die Biomfarbe → volle Stimmungs-Kontrolle. Gecacht. */
const matCache = new Map();
function natureMaterial(matName, biome) {
  const L = biome.leaf;
  const key = matName + '|' + biome.name + '|' + (biome.assetTint || '');
  if (matCache.has(key)) return matCache.get(key);
  let c;
  if (matName === 'BirchTree_Bark') c = new THREE.Color(0xece8dc);
  else if (matName.includes('Bark')) c = new THREE.Color(biome.trunk);
  else if (matName.includes('Leaves')) c = new THREE.Color().setHSL(L.h, L.s, L.l);
  else if (matName === 'Bush_Leaves') c = new THREE.Color().setHSL(L.h + .02, L.s * .9, Math.max(.14, L.l - .05));
  else if (matName === 'Grass') c = new THREE.Color().setHSL(L.h + .03, L.s * .8, L.l + .06);
  else if (matName === 'Rock') c = new THREE.Color(0x9aa3a8);
  else if (matName === 'Flowers') c = new THREE.Color(0xe06a9a);
  else c = new THREE.Color(0x8a8a8a);
  if (biome.assetTint) c.multiply(new THREE.Color(biome.assetTint));
  const m = toonMat({ color: c });
  matCache.set(key, m);
  return m;
}
function natureClone(key, biome) {
  const src = NATURE[key];
  if (!src) return null;
  const grp = src.clone(true);
  grp.traverse(o => {
    if (!o.isMesh) return;
    o.material = natureMaterial(o.material.name || '', biome);
  });
  return grp;
}
function pickAsset(list, seed, salt) {
  return list[Math.floor(hash3(seed, salt, 17) * list.length) % list.length];
}

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

/* Standard-Biom (Wächterlichtung) als Default, damit Aufrufer ohne
   Biom-Wissen (z.B. Boss-Baumring vor Biome-Einführung) weiter laufen */
const DEFAULT_BIOME = { leaf: { h: .30, hVar: .08, s: .55, l: .38 }, pine: .4, trunk: 0x6e4b2a };

export function makeTree(seed, biome = DEFAULT_BIOME) {
  /* echtes Asset, wenn geladen + Biom konfiguriert */
  if (biome.assets) {
    const key = pickAsset(biome.assets.trees, seed, 1);
    const m = natureClone(key, biome);
    if (m) {
      const g = new THREE.Group();
      g.add(m);
      g.scale.setScalar((0.85 + hash3(seed, 12, 12) * 0.7) * familyScale(key));
      return g;
    }
  }
  const grp = new THREE.Group();
  const pine = hash3(seed, 1, 1) < biome.pine;
  /* Knuddel-Proportionen: dickere Stämme, gedrungene Silhouette */
  const trunkH = pine ? 1.6 : 1.3 + hash3(seed, 2, 2) * 1.1;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.24, .42, trunkH, 8),
    toonMat({ color: biome.trunk }));
  trunk.position.y = trunkH / 2; grp.add(trunk);
  if (biome.birch && !pine) {
    /* Birken: dunkle Querbänder auf hellem Stamm */
    for (let k = 0; k < 3; k++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.30, .30, .1, 8),
        toonMat({ color: 0x3a3a34 }));
      band.position.y = trunkH * (.25 + k * .27);
      grp.add(band);
    }
  }
  const L = biome.leaf;
  if (pine) {
    const c = new THREE.Color().setHSL(L.h + .06, L.s, Math.max(.12, L.l - .11) + hash3(seed, 3, 3) * .08);
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(deformGeo(new THREE.ConeGeometry(1.6 - k * .42, 1.6, 9), .14),
        toonMat({ color: c }));
      cone.position.y = trunkH + .55 + k * 1.05;
      grp.add(cone);
    }
  } else {
    const c = new THREE.Color().setHSL(L.h + hash3(seed, 4, 4) * L.hVar, L.s, L.l + hash3(seed, 5, 5) * .1);
    const n = 2 + Math.floor(hash3(seed, 6, 6) * 2);
    for (let k = 0; k < n; k++) {
      /* fettere, rundere Kronen, tiefer angesetzt (gedrungen-knuddelig) */
      const ball = new THREE.Mesh(deformGeo(new THREE.IcosahedronGeometry(1.45 + hash3(seed, k, 7) * .85, 2), .24),
        toonMat({ color: c.clone().offsetHSL(0, 0, (hash3(seed, k, 8) - .5) * .08) }));
      ball.position.set((hash3(seed, k, 9) - .5) * 1.4, trunkH + .65 + hash3(seed, k, 10) * 1.1, (hash3(seed, k, 11) - .5) * 1.4);
      grp.add(ball);
    }
  }
  castAll(grp);
  grp.scale.setScalar(.85 + hash3(seed, 12, 12) * .75);
  return grp;
}
export function makeBush(seed, biome = DEFAULT_BIOME) {
  if (biome.assets) {
    const key = pickAsset(biome.assets.bushes, seed, 2);
    const m = natureClone(key, biome);
    if (m) {
      const g = new THREE.Group();
      g.add(m);
      g.scale.setScalar((0.8 + hash3(seed, 9, 9) * 0.6) * familyScale(key));
      return g;
    }
  }
  const grp = new THREE.Group();
  const L = biome.leaf;
  const c = new THREE.Color().setHSL(L.h + .02, L.s * .9, Math.max(.14, L.l - .06) + hash3(seed, 1, 2) * .1);
  const b = new THREE.Mesh(deformGeo(new THREE.IcosahedronGeometry(.75, 2), .4),
    toonMat({ color: c }));
  b.position.y = .55; b.castShadow = true; grp.add(b);
  return grp;
}
export function makeStone(seed, biome) {
  if (biome && biome.assets) {
    const key = pickAsset(biome.assets.rocks, seed, 3);
    const m = natureClone(key, biome);
    if (m) {
      const g = new THREE.Group();
      g.add(m);
      g.scale.setScalar((0.6 + hash3(seed, 5, 5) * 0.8) * familyScale(key));
      return g;
    }
  }
  const m = new THREE.Mesh(deformGeo(new THREE.IcosahedronGeometry(.4 + hash3(seed, 1, 1) * .7, 1), .6),
    toonMat({ color: 0x9aa3a8 }));
  m.position.y = .25; m.castShadow = true;
  return m;
}
export function makeFlowerPatch(seed) {
  const grp = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const c = COLORS[Math.floor(hash3(seed, k, 3) * COLORS.length)].hex;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 5),
      toonMat({ color: c }));
    head.position.set((hash3(seed, k, 4) - .5) * .7, .34, (hash3(seed, k, 5) - .5) * .7);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .3, 4),
      toonMat({ color: 0x3f7d33 }));
    stem.position.set(head.position.x, .16, head.position.z);
    grp.add(stem); grp.add(head);
  }
  return grp;
}
export function makeBigFlower(colorDef, seed) {
  const grp = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, 1.6, 6),
    toonMat({ color: 0x3f7d33 }));
  stem.position.y = .8; grp.add(stem);
  const center = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8),
    toonMat({ color: 0xffe9a3 }));
  center.position.y = 1.7; grp.add(center);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.ConeGeometry(.22, .8, 5),
      toonMat({ color: colorDef.hex }));
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
/* Partikel-Stimmung je Biom: Pollen, fallende Blätter, Irrlichter */
let irrlichtMode = false;
export function setParticleStyle(p) {
  if (!pollenPts) return;
  pollenPts.material.color.setHex(p.color);
  pollenPts.material.size = p.size;
  pollenPts.material.opacity = p.irrlicht ? .9 : .75;
  irrlichtMode = !!p.irrlicht;
}
export function updatePollen(time, dt) {
  if (pollenGrp) { pollenGrp.position.x = camPos.x; pollenGrp.position.z = camPos.z; }
  if (pollenPts && pollenPts.visible) {
    const arr = pollenPts.geometry.attributes.position.array;
    const sd = pollenPts.userData.seed;
    /* Irrlichter schweben tief und träge, Pollen tanzen höher */
    const sx = irrlichtMode ? .25 : .6, sy = irrlichtMode ? .2 : .4;
    const maxH = irrlichtMode ? 3.2 : 7.5;
    for (let i = 0; i < sd.length; i++) {
      arr[i * 3] += Math.sin(time * sx + sd[i]) * dt * .5;
      arr[i * 3 + 1] += Math.cos(time * sy + sd[i]) * dt * .3;
      if (arr[i * 3 + 1] < .3) arr[i * 3 + 1] = maxH * .8;
      if (arr[i * 3 + 1] > maxH) arr[i * 3 + 1] = .5;
    }
    pollenPts.geometry.attributes.position.needsUpdate = true;
  }
}
