/* =====================================================================
   ATMOSPHÄRE – Tageszeit-Verlauf pro Gebiet
   Morgen (Start) → Tag → Abend → Dämmerung (Boss). Weiche Übergänge
   beim Weiterreisen, leichte Farbstimmungs-Variation je Gebiet.
   Nebelschwaden (ab MITTEL) und Gottesstrahlen (ab HOCH) respektieren
   den AUTO-FPS-Governor. Alles uniform-/farbbasiert: keine teuren
   Zusatzpässe, iPad-sicher.
   ===================================================================== */
import * as THREE from 'three';
import { scene, sun, hemi } from '../engine/renderer.js';
import { QUALITY, qTier } from '../engine/quality.js';
import { glowTex, glowSprite } from '../engine/textures.js';
import { skyMat, sunSprite } from './sky.js';
import { hash3, hillH } from './terrain.js';

/* Tageszeit-Keyframes: p 0=Morgen … 1=Dämmerung (Boss).
   Intensitäten in r128-Werten; ×π passiert beim Anwenden.
   sunY = Höhe des Richtungslichts (tiefer = längere, wärmere Schatten),
   sprY/sprS = Höhe und Größe des sichtbaren Sonnen-Sprites. */
const STOPS = [
  /* Morgen: goldenes Frühlicht statt grauem Dunst */
  { p: 0,   top: 0x5f97ea, hor: 0xffd9a3, sun: 0xffd28a, sunI: 1.1,  hemiSky: 0xdfe9ff, hemiGr: 0x7f9a58, hemiI: .8,  fog: 0xf2ddba, fogN: 32, fogF: 96,  sprite: 0xffe3a8, sunY: 22, sprY: 48, sprS: 60 },
  /* Tag: helle Referenz (Prototyp-Look) */
  { p: .35, top: 0x549ef0, hor: 0xe6f5ff, sun: 0xfff1cf, sunI: 1.35, hemiSky: 0xcfe6ff, hemiGr: 0x77995a, hemiI: .85, fog: 0xcfe9fb, fogN: 36, fogF: 100, sprite: 0xfff6d8, sunY: 38, sprY: 80, sprS: 55 },
  /* Später Nachmittag: erstes Anwärmen */
  { p: .6,  top: 0x4d7ad9, hor: 0xffd9a3, sun: 0xffd998, sunI: 1.15, hemiSky: 0xe8dcc8, hemiGr: 0x6f8a50, hemiI: .78, fog: 0xeedec0, fogN: 33, fogF: 94,  sprite: 0xffe3ae, sunY: 26, sprY: 58, sprS: 58 },
  /* GOLDEN HOUR: tiefe Sonne, sattes Gold, lange Schatten */
  { p: .85, top: 0x3f5cb8, hor: 0xff9d4d, sun: 0xff9d50, sunI: 1.0,  hemiSky: 0xe8b890, hemiGr: 0x5a6a40, hemiI: .66, fog: 0xf0b070, fogN: 28, fogF: 84,  sprite: 0xffb060, sunY: 14, sprY: 34, sprS: 68 },
  /* Dämmerung (Boss): dunkel, tiefes Blauviolett */
  { p: 1,   top: 0x191a45, hor: 0x6e4070, sun: 0x9f7be0, sunI: .55,  hemiSky: 0x55477e, hemiGr: 0x2c2c40, hemiI: .50, fog: 0x3d3552, fogN: 22, fogF: 70,  sprite: 0xc9a0ff, sunY: 10, sprY: 26, sprS: 60 }
];
/* dezente Farbstimmung je Gebiet (Hue-Shift auf Himmel + Nebel) */
const FLOOR_HUE = [0, .025, -.035, .045, -.02, .06];

const cur = {
  top: new THREE.Color(0x549ef0), hor: new THREE.Color(0xe6f5ff),
  sun: new THREE.Color(0xfff1cf), sunI: 1.35,
  hemiSky: new THREE.Color(0xcfe6ff), hemiGr: new THREE.Color(0x77995a), hemiI: .85,
  fog: new THREE.Color(0xcfe9fb), fogN: 36, fogF: 100,
  sprite: new THREE.Color(0xfff6d8), sunY: 38, sprY: 80, sprS: 55
};
export function currentSunHeight() { return cur.sunY; }
let tgt = null;

function lerpStop(p) {
  let a = STOPS[0], b = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (p >= STOPS[i].p && p <= STOPS[i + 1].p) { a = STOPS[i]; b = STOPS[i + 1]; break; }
  }
  const k = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
  const col = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), k);
  const num = (x, y) => x + (y - x) * k;
  return {
    top: col(a.top, b.top), hor: col(a.hor, b.hor),
    sun: col(a.sun, b.sun), sunI: num(a.sunI, b.sunI),
    hemiSky: col(a.hemiSky, b.hemiSky), hemiGr: col(a.hemiGr, b.hemiGr), hemiI: num(a.hemiI, b.hemiI),
    fog: col(a.fog, b.fog), fogN: num(a.fogN, b.fogN), fogF: num(a.fogF, b.fogF),
    sprite: col(a.sprite, b.sprite),
    sunY: num(a.sunY, b.sunY), sprY: num(a.sprY, b.sprY), sprS: num(a.sprS, b.sprS)
  };
}

/* progress 0..1 innerhalb des Gebiets; floor für die Farbstimmung */
export function setAtmosphere(progress, floor, snap = false) {
  tgt = lerpStop(Math.min(1, Math.max(0, progress)));
  const hue = FLOOR_HUE[(floor - 1) % FLOOR_HUE.length];
  tgt.top.offsetHSL(hue, 0, 0);
  tgt.hor.offsetHSL(hue, 0, 0);
  tgt.fog.offsetHSL(hue, 0, 0);
  if (snap) {
    cur.top.copy(tgt.top); cur.hor.copy(tgt.hor); cur.sun.copy(tgt.sun);
    cur.hemiSky.copy(tgt.hemiSky); cur.hemiGr.copy(tgt.hemiGr);
    cur.fog.copy(tgt.fog); cur.sprite.copy(tgt.sprite);
    cur.sunI = tgt.sunI; cur.hemiI = tgt.hemiI; cur.fogN = tgt.fogN; cur.fogF = tgt.fogF;
    cur.sunY = tgt.sunY; cur.sprY = tgt.sprY; cur.sprS = tgt.sprS;
  }
}

/* ---------- Nebelschwaden & Gottesstrahlen (pro Gebiet neu verteilt) ---------- */
let mistGroup = null, raysGroup = null;

function clearGroup(g) {
  if (!g) return;
  g.traverse(o => { if (o.material && o.material !== null && o.material.dispose) o.material.dispose(); });
  scene.remove(g);
}
export function rebuildFloorFx(segs, stations) {
  clearGroup(mistGroup); clearGroup(raysGroup);
  mistGroup = new THREE.Group(); raysGroup = new THREE.Group();
  scene.add(mistGroup); scene.add(raysGroup);

  /* Bodennebel entlang des Pfads */
  let i = 0;
  for (const seg of segs) {
    for (let k = 0; k < 2; k++, i++) {
      const dir = seg.b.clone().sub(seg.a); const len = dir.length(); dir.normalize();
      const lat = new THREE.Vector3(-dir.z, 0, dir.x);
      const p = seg.a.clone()
        .addScaledVector(dir, hash3(i, 1, 7) * len)
        .addScaledVector(lat, (hash3(i, 2, 5) - .5) * 14);
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xf2f5f7, transparent: true, opacity: .12, depthWrite: false }));
      m.scale.set(10 + hash3(i, 3, 9) * 8, 3.2, 1);
      m.position.set(p.x, hillH(p.x, p.z) + 1.1, p.z);
      m.userData.seed = hash3(i, 4, 11) * 100;
      m.userData.baseX = m.position.x;
      mistGroup.add(m);
    }
  }
  /* Gottesstrahlen über Begegnungs-Lichtungen */
  stations.forEach((st, si) => {
    if (st.type !== 'MOB' && st.type !== 'BOSS') return;
    const lat = new THREE.Vector3(-st.dir.z, 0, st.dir.x);
    [-1.6, 1.4].forEach((off, k) => {
      const r = glowSprite(0xfff2cc, 1);
      r.material.opacity = .13;
      r.material.rotation = .32 * (k === 0 ? 1 : -.8);
      r.scale.set(2.4, 13, 1);
      r.position.copy(st.pos).addScaledVector(lat, off).add(new THREE.Vector3(0, 7.2, 0));
      r.userData.ray = true;
      raysGroup.add(r);
    });
  });
}

export function updateAtmosphere(dt, time) {
  if (!tgt || !skyMat) return;
  const k = Math.min(1, dt * 1.1); /* weicher Übergang über ~2–3 s */
  cur.top.lerp(tgt.top, k); cur.hor.lerp(tgt.hor, k);
  cur.sun.lerp(tgt.sun, k); cur.hemiSky.lerp(tgt.hemiSky, k);
  cur.hemiGr.lerp(tgt.hemiGr, k); cur.fog.lerp(tgt.fog, k);
  cur.sprite.lerp(tgt.sprite, k);
  cur.sunI += (tgt.sunI - cur.sunI) * k;
  cur.hemiI += (tgt.hemiI - cur.hemiI) * k;
  cur.fogN += (tgt.fogN - cur.fogN) * k;
  cur.fogF += (tgt.fogF - cur.fogF) * k;
  cur.sunY += (tgt.sunY - cur.sunY) * k;
  cur.sprY += (tgt.sprY - cur.sprY) * k;
  cur.sprS += (tgt.sprS - cur.sprS) * k;

  skyMat.uniforms.uTop.value.copy(cur.top);
  skyMat.uniforms.uHor.value.copy(cur.hor);
  sun.color.copy(cur.sun); sun.intensity = cur.sunI * Math.PI;
  hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGr);
  hemi.intensity = cur.hemiI * Math.PI;
  scene.fog.color.copy(cur.fog);
  scene.fog.near = cur.fogN; scene.fog.far = cur.fogF;
  scene.background.copy(cur.hor);
  if (sunSprite) {
    sunSprite.material.color.copy(cur.sprite);
    sunSprite.userData.followCamOffset.y = cur.sprY;
    sunSprite.scale.set(cur.sprS, cur.sprS, 1);
  }

  const q = QUALITY[qTier];
  if (mistGroup) {
    mistGroup.visible = q.pollen;
    if (mistGroup.visible) mistGroup.children.forEach(m => {
      m.position.x = m.userData.baseX + Math.sin(time * .07 + m.userData.seed) * 2.2;
    });
  }
  if (raysGroup) {
    raysGroup.visible = q.bloom;
    if (raysGroup.visible) raysGroup.children.forEach(r => {
      r.material.color.copy(cur.sun);
      r.material.opacity = .09 + Math.sin(time * .5 + r.position.x) * .04;
    });
  }
}
