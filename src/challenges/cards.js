/* =====================================================================
   WORTKARTEN (3D-Silbenkarten)
   depthTest:false + renderOrder:10 → Karten werden NIE verdeckt.
   Erhöhter Buchstabenabstand (Hair-Spaces) = Crowding-Reduktion.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { camPos } from '../engine/camera.js';

export let cards = [];

/* Knuddel-Look: doppelte Auflösung (Retina-scharf), runde Ecken,
   warmer Holzrand mit Creme-Highlight, weicher Schatten.
   Verdana + Hair-Spaces bleiben (Therapie: Crowding-Reduktion). */
function cardTexture(text) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 384;
  const ctx = cv.getContext('2d');
  const rr = (x0, y0, x1, y1, r) => {
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x1, y0, x1, y1, r); ctx.arcTo(x1, y1, x0, y1, r);
    ctx.arcTo(x0, y1, x0, y0, r); ctx.arcTo(x0, y0, x1, y0, r);
    ctx.closePath();
  };
  /* weicher Schatten unter der Karte (Tiefe) */
  ctx.save();
  ctx.shadowColor = 'rgba(40,25,10,.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  rr(26, 24, 486, 352, 64); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  /* Karten-Fläche: cremiger Verlauf */
  const grd = ctx.createLinearGradient(0, 24, 0, 352);
  grd.addColorStop(0, '#fffdf4'); grd.addColorStop(.7, '#fbf2dc'); grd.addColorStop(1, '#f1e2bd');
  rr(26, 24, 486, 352, 64); ctx.fillStyle = grd; ctx.fill();
  /* warmer Holzrand + inneres Creme-Highlight */
  ctx.lineWidth = 13; ctx.strokeStyle = '#a4774a'; rr(26, 24, 486, 352, 64); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,250,235,.85)';
  rr(36, 34, 476, 342, 54); ctx.stroke();
  /* Silbe: Verdana, dunkelbraun, erhöhter Buchstabenabstand */
  ctx.fillStyle = '#3a2410';
  let size = text.length <= 3 ? 168 : (text.length <= 5 ? 126 : (text.length <= 7 ? 94 : 74));
  ctx.font = `bold ${size}px Verdana,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text.split('').join('\u200a\u200a') /* Hair-Spaces */, 256, 192);
  const tx = new THREE.CanvasTexture(cv);
  tx.anisotropy = 4;
  return tx;
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
