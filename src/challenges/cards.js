/* =====================================================================
   WORTKARTEN (3D-Silbenkarten)
   depthTest:false + renderOrder:10 → Karten werden NIE verdeckt.
   Erhöhter Buchstabenabstand (Hair-Spaces) = Crowding-Reduktion.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { camPos } from '../engine/camera.js';

export let cards = [];

function cardTexture(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192;
  const ctx = cv.getContext('2d');
  const r = 26;
  ctx.beginPath();
  ctx.moveTo(r, 10); ctx.arcTo(246, 10, 246, 182, r); ctx.arcTo(246, 182, 10, 182, r);
  ctx.arcTo(10, 182, 10, 10, r); ctx.arcTo(10, 10, 246, 10, r); ctx.closePath();
  const grd = ctx.createLinearGradient(0, 0, 0, 192);
  grd.addColorStop(0, '#fdf6e3'); grd.addColorStop(1, '#ecd9ad');
  ctx.fillStyle = grd; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = '#8a5f33'; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(70,214,138,.9)';
  ctx.shadowColor = '#46d68a'; ctx.shadowBlur = 12; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2b1c0c';
  let size = text.length <= 3 ? 86 : (text.length <= 5 ? 64 : (text.length <= 7 ? 48 : 38));
  ctx.font = `bold ${size}px Verdana,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text.split('').join('\u200a\u200a') /* Hair-Spaces: erhöhter Buchstabenabstand */, 128, 100);
  return new THREE.CanvasTexture(cv);
}
export function makeCard(text, correctIndex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.42),
    new THREE.MeshBasicMaterial({ map: cardTexture(text), transparent: true, side: THREE.DoubleSide, depthTest: false }));
  m.renderOrder = 10; /* Karten IMMER über der Welt – nie verdeckt */
  m.userData = { syl: text, correctIndex, baseY: 0, phase: Math.random() * 6.28, dead: false };
  scene.add(m); cards.push(m); return m;
}
export function clearCards() { cards.forEach(r => scene.remove(r)); cards = []; }
export function removeCard(r) { scene.remove(r); }

/* Übrige Karten (Distraktoren) sanft ausblenden statt instant zu
   entfernen – schlagartiges Verschwinden wirkt wie ein Glitch */
export function dismissCards(addAnim) {
  cards.forEach(r => {
    if (r.userData.dead) return;
    r.userData.dead = true;
    let t = 0;
    const sy = r.position.y;
    addAnim({ update(dt) {
      t += dt * 2.2;
      r.scale.setScalar(Math.max(.001, 1 - t));
      r.position.y = sy - t * .8;
      if (t >= 1) { scene.remove(r); return true; }
      return false;
    } });
  });
  cards = [];
}

export function updateCards(dt) {
  cards.forEach(r => {
    if (r.userData.dead) return;
    r.userData.phase += dt * 1.7;
    r.position.y = r.userData.baseY + Math.sin(r.userData.phase) * .08;
    r.lookAt(camPos.x, r.position.y + .6, camPos.z);
  });
}
