/* ---------- Kamera-Rig (Schwebe-Reise + Maus-Parallaxe + Shake) ---------- */
import * as THREE from 'three';
import { camera, sun, sunTarget } from './renderer.js';
import { currentSunHeight } from '../world/atmosphere.js';

export const rigPos = new THREE.Vector3(), rigFocus = new THREE.Vector3();
export const camPos = new THREE.Vector3(), camFocus = new THREE.Vector3();
export let mouseX = 0, mouseY = 0;
let shakeT = 0;

export function initCameraInput() {
  addEventListener('pointermove', e => {
    mouseX = e.clientX / innerWidth - .5; mouseY = e.clientY / innerHeight - .5;
  });
}
export function screenShake(amt = 1) { shakeT = Math.max(shakeT, .28 * amt); }

export function updateCamera(dt) {
  let sx = 0, sy = 0;
  if (shakeT > 0) { shakeT -= dt; sx = (Math.random() - .5) * shakeT * 2.4; sy = (Math.random() - .5) * shakeT * 2.4; }
  camPos.set(rigPos.x + mouseX * 1.4 + sx, rigPos.y - mouseY * 1 + sy, rigPos.z);
  camFocus.lerp(rigFocus, .12);
  camera.position.copy(camPos);
  camera.lookAt(camFocus);

  if (sun) {
    /* Sonnenhöhe folgt der Tageszeit: tief = lange Golden-Hour-Schatten */
    sun.position.set(camPos.x + 24, currentSunHeight(), camPos.z + 14);
    sunTarget.position.set(camPos.x, 0, camPos.z - 8);
  }
}
