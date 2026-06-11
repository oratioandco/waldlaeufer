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
   Intensitäten in r128-Werten; ×π passiert beim Anwenden. */
const STOPS = [
  { p: 0,   top: 0x6b9ef3, hor: 0xfce6cc, sun: 0xffe2b0, sunI: 1.20, hemiSky: 0xd9e9ff, hemiGr: 0x7f9a58, hemiI: .85, fog: 0xe6e9ef, fogN: 36, fogF: 100, sprite: 0xfff0d0 },
  { p: .4,  top: 0x549ef0, hor: 0xe6f5ff, sun: 0xfff1cf, sunI: 1.35, hemiSky: 0xcfe6ff, hemiGr: 0x77995a, hemiI: .85, fog: 0xcfe9fb, fogN: 36, fogF: 100, sprite: 0xfff6d8 },
  { p: .75, top: 0x4d6bcc, hor: 0xffbd85, sun: 0xffc080, sunI: 1.10, hemiSky: 0xe3cfd4, hemiGr: 0x6a7a4a, hemiI: .75, fog: 0xead2bb, fogN: 32, fogF: 92,  sprite: 0xffd9a0 },
  { p: 1,   top: 0x26265c, hor: 0x855780, sun: 0xb389e8, sunI: .75,  hemiSky: 0x6a5a9a, hemiGr: 0x3a3a52, hemiI: .60, fog: 0x4f4566, fogN: 26, fogF: 78,  sprite: 0xc9a0ff }
];
/* dezente Farbstimmung je Gebiet (Hue-Shift auf Himmel + Nebel) */
const FLOOR_HUE = [0, .025, -.035, .045, -.02, .06];

const cur = {
  top: new THREE.Color(0x549ef0), hor: new THREE.Color(0xe6f5ff),
  sun: new THREE.Color(0xfff1cf), sunI: 1.35,
  hemiSky: new THREE.Color(0xcfe6ff), hemiGr: new THREE.Color(0x77995a), hemiI: .85,
  fog: new THREE.Color(0xcfe9fb), fogN: 36, fogF: 100,
  sprite: new THREE.Color(0xfff6d8)
};
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
    sprite: col(a.sprite, b.sprite)
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

  skyMat.uniforms.uTop.value.copy(cur.top);
  skyMat.uniforms.uHor.value.copy(cur.hor);
  sun.color.copy(cur.sun); sun.intensity = cur.sunI * Math.PI;
  hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGr);
  hemi.intensity = cur.hemiI * Math.PI;
  scene.fog.color.copy(cur.fog);
  scene.fog.near = cur.fogN; scene.fog.far = cur.fogF;
  scene.background.copy(cur.hor);
  if (sunSprite) sunSprite.material.color.copy(cur.sprite);

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
