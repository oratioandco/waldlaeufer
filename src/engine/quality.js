/* =====================================================================
   QUALITÄT – Stufen + AUTO-FPS-Governor (runter <40 fps, hoch >56 fps)
   Ältere iPads sind Zielgeräte.
   ===================================================================== */
import { renderer, sun, setupRT } from './renderer.js';
import { grassMesh, grassPlaced } from '../world/grass.js';
import { pollenPts, extraDecor, setForestQuality } from '../world/vegetation.js';

export const QUALITY = [
  { name: 'NIEDRIG', prMul: .8,  shadow: 0,    bloom: false, grass: 900,  extras: false, pollen: false },
  { name: 'MITTEL',  prMul: 1.0, shadow: 1024, bloom: false, grass: 3200, extras: true,  pollen: true },
  { name: 'HOCH',    prMul: 1.15, shadow: 1024, bloom: true,  grass: 6000, extras: true,  pollen: true },
  { name: 'ULTRA',   prMul: 1.35, shadow: 2048, bloom: true,  grass: 9000, extras: true,  pollen: true }
];
export let qTier = 2, qAuto = true, RES = 1.0;
let fpsEMA = 60, fpsEval = 0;

export function setRES(v) {
  RES = v;
  if (renderer) { renderer.setPixelRatio(effectivePR()); setupRT(); }
}
export function effectivePR() {
  return Math.min(4, Math.max(.5, devicePixelRatio * QUALITY[qTier].prMul * RES));
}
export function applyQuality() {
  const q = QUALITY[qTier];
  if (renderer) { renderer.setPixelRatio(effectivePR()); setupRT(); }
  if (sun) {
    sun.castShadow = q.shadow > 0;
    if (q.shadow > 0) {
      sun.shadow.mapSize.set(q.shadow, q.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
  }
  if (grassMesh) grassMesh.count = Math.min(grassPlaced(), q.grass);
  if (pollenPts) pollenPts.visible = q.pollen;
  extraDecor.forEach(o => o.visible = q.extras);
  setForestQuality(q.extras);
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('on', (qAuto && c.dataset.q === 'auto') || (!qAuto && c.dataset.q == String(qTier)));
  });
}
export function setQuality(v) {
  if (v === 'auto') { qAuto = true; } else { qAuto = false; qTier = v; }
  applyQuality();
}
export function autoGovern(dt) {
  const fps = 1 / Math.max(dt, 1e-4);
  fpsEMA += (fps - fpsEMA) * .04;
  fpsEval += dt;
  if (fpsEval > 3) {
    fpsEval = 0;
    document.getElementById('fpsTag').textContent = Math.round(fpsEMA) + ' fps · ' + QUALITY[qTier].name;
    if (!qAuto) return;
    if (fpsEMA < 40 && qTier > 0) { qTier--; applyQuality(); }
    else if (fpsEMA > 56 && qTier < 3) { qTier++; applyQuality(); }
  }
}
