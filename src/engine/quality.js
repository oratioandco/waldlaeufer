/* =====================================================================
   QUALITÄT – Stufen + AUTO-FPS-Governor (runter <40 fps, hoch >56 fps)
   Ältere iPads sind Zielgeräte.
   ===================================================================== */
import { renderer, sun, setupRT } from './renderer.js';
import { grassMesh, grassPlaced } from '../world/grass.js';
import { pollenPts, extraDecor, setForestQuality } from '../world/vegetation.js';

/* Breiteres Spektrum (5 Stufen): ältere iPads bekommen unten Luft,
   moderne Geräte oben Details. Der AUTO-Governor wandert frei durch. */
export const QUALITY = [
  { name: 'SPARSAM', prMul: .62, shadow: 0,    bloom: false, grass: 320,  extras: false, pollen: false, forestFar: false },
  { name: 'NIEDRIG', prMul: .85, shadow: 0,    bloom: false, grass: 1000, extras: false, pollen: true,  forestFar: false },
  { name: 'MITTEL',  prMul: 1.0, shadow: 1024, bloom: false, grass: 2800, extras: true,  pollen: true,  forestFar: true },
  { name: 'HOCH',    prMul: 1.15, shadow: 1024, bloom: true,  grass: 5400, extras: true,  pollen: true,  forestFar: true },
  { name: 'ULTRA',   prMul: 1.35, shadow: 2048, bloom: true,  grass: 8200, extras: true,  pollen: true,  forestFar: true }
];
/* Start auf MITTEL (Index 2): sicher für die meisten Geräte, der
   Governor zieht binnen Sekunden hoch oder runter. */
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
  setForestQuality(q.forestFar);
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
  if (fpsEval > 2.4) {
    fpsEval = 0;
    document.getElementById('fpsTag').textContent = Math.round(fpsEMA) + ' fps · ' + QUALITY[qTier].name;
    if (!qAuto) return;
    /* Runter bei <44 fps (Notbremse <30 → zwei Stufen), hoch erst ab >57 */
    if (fpsEMA < 30 && qTier > 0) { qTier = Math.max(0, qTier - 2); applyQuality(); }
    else if (fpsEMA < 44 && qTier > 0) { qTier--; applyQuality(); }
    else if (fpsEMA > 57 && qTier < QUALITY.length - 1) { qTier++; applyQuality(); }
  }
}
