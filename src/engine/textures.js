/* ---------- Prozedurale Sprites/Texturen ---------- */
import * as THREE from 'three';

export let glowTex = null, shadowTex = null;

export function initTextures() {
  glowTex = makeGlowTex();
  shadowTex = makeShadowTex();
}
function makeGlowTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
function makeShadowTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(.7, 'rgba(0,0,0,.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
/* Gibt Geometrie + Material(ien) (+ deren Texturen) eines Objekts/Baums frei.
   GPU-Leak-Schutz: ohne dispose() bleiben Buffer/Texturen im Treiber liegen –
   über eine lange Sitzung (viele Karten/Gegner) friert das Gerät sonst ein.
   Die GETEILTEN Sprites-Texturen (glowTex/shadowTex) werden NIE freigegeben,
   sonst rendern alle weiteren Sprites/Schatten kaputt. */
export function disposeTree(obj) {
  if (!obj) return;
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (m.map && m.map !== glowTex && m.map !== shadowTex) m.map.dispose();
      if (m.dispose) m.dispose();
    }
  });
}
export function glowSprite(color, scale) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.set(scale, scale, 1); return sp;
}
export function blobShadow(scale) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .04;
  return m;
}
