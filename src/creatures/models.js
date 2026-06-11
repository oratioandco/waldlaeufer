/* ---------- GLTF-Modelle laden (lokal aus public/assets/models/) ----------
   Lade-Fehler → Blob-Fallback bleibt aktiv. Nur 1 Gegner gleichzeitig →
   Modell-Instanzen werden wiederverwendet (kein SkeletonUtils-Clone). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ANIMALS } from './data.js';

export const MODELS = {};

export function loadModels() {
  try {
    const loader = new GLTFLoader();
    ANIMALS.forEach(a => {
      loader.load(a.url, g => {
        g.scene.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true;
            if (o.material) o.material.side = THREE.DoubleSide;
          }
        });
        MODELS[a.key] = { scene: g.scene, clips: g.animations || [] };
      }, undefined, () => { /* Modell-Fehler → Blob-Fallback bleibt */ });
    });
  } catch (e) { /* kein Loader → Blob-Fallback */ }
}
