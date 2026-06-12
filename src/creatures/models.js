/* ---------- GLTF-Modelle laden (lokal aus public/assets/models/) ----------
   Lade-Fehler → Blob-Fallback bleibt aktiv. Nur 1 Gegner gleichzeitig →
   Modell-Instanzen werden wiederverwendet (kein SkeletonUtils-Clone).
   Quaternius-Tiere (animals/) haben benannte Clips (Idle, Gallop, …)
   und Farb-Materialien → werden auf den Welt-Toon-Look umgezogen. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ANIMALS } from './data.js';
import { toonMat } from '../engine/materials.js';

export const MODELS = {};
const pending = {};

/* Toon-Materialien pro Farbe cachen (weniger Shader-Programme) */
const toonCache = {};
function toonFor(srcMat) {
  const c = (srcMat && srcMat.color) ? srcMat.color.getHex() : 0xaaaaaa;
  if (!toonCache[c]) {
    toonCache[c] = toonMat({ color: c });
    toonCache[c].side = THREE.DoubleSide;
  }
  return toonCache[c];
}

export function prepModel(root, opts = {}) {
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false; /* skinned: Bind-Pose-Bounds ≠ Anim-Pose */
      if (opts.toon && o.material) {
        o.material = Array.isArray(o.material)
          ? o.material.map(toonFor) : toonFor(o.material);
      } else if (o.material) o.material.side = THREE.DoubleSide;
    }
  });
}

/* Clip nach Name wählen ('Idle', 'Gallop', …) – Fallback erster Clip.
   Die alten three.js-Beispieltiere haben nur einen unbenannten Clip. */
export function pickClip(clips, ...names) {
  for (const n of names) {
    const c = clips.find(c => c.name && c.name.toLowerCase() === n.toLowerCase());
    if (c) return c;
  }
  return clips[0] || null;
}

export function loadModelOnce(key, url, opts = {}) {
  if (MODELS[key]) return Promise.resolve(MODELS[key]);
  if (pending[key]) return pending[key];
  pending[key] = new Promise(res => {
    try {
      new GLTFLoader().load(url, g => {
        prepModel(g.scene, opts);
        MODELS[key] = { scene: g.scene, clips: g.animations || [] };
        delete pending[key];
        res(MODELS[key]);
      }, undefined, () => { delete pending[key]; res(null); });
    } catch (e) { delete pending[key]; res(null); }
  });
  return pending[key];
}

export function loadModels() {
  ANIMALS.forEach(a => loadModelOnce(a.key, a.url, { toon: a.toon }));
}
