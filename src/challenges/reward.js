/* =====================================================================
   REWARD-COLLECTION-FLOW (wiederverwendbar)
   3D-Juwel steigt auf → Strahlen + Klang am Scheitelpunkt →
   💎-Flug zum HUD-Zähler → Zähler pulsiert und tickt einzeln hoch.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { addAnim, easeOut } from '../engine/anims.js';
import { glowSprite } from '../engine/textures.js';
import { G } from '../state.js';
import { renderHUD } from '../ui/hud.js';
import { gemFlightToHud } from '../ui/feedback.js';
import { sndGem } from '../audio/sfx.js';

export function spawnGemReward(start, count, onDone) {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.OctahedronGeometry(.42),
    new THREE.MeshBasicMaterial({ color: 0x9fe8ff })));
  grp.add(new THREE.Mesh(new THREE.OctahedronGeometry(.26),
    new THREE.MeshBasicMaterial({ color: 0xeffdff })));
  grp.add(glowSprite(0x9fe8ff, 2.4));
  const apexY = start.y + 1.9;
  grp.position.copy(start);
  grp.scale.setScalar(.001);
  scene.add(grp);
  let t = 0, raysDone = false;
  addAnim({ update(dt) {
    t += dt;
    grp.rotation.y += dt * 3.5;
    if (t < .55) {
      const k = easeOut(t / .55);
      grp.scale.setScalar(k);
      grp.position.y = start.y + (apexY - start.y) * k;
    } else if (!raysDone) {
      raysDone = true;
      spawnRays(grp.position.clone());
      sndGem(0); sndGem(1); sndGem(2);
    }
    if (t >= 1.15) {
      const pos = grp.position.clone();
      scene.remove(grp);
      gemFlightToHud(pos, () => collectGems(count, onDone));
      return true;
    }
    return false;
  } });
}
function spawnRays(pos) {
  for (let i = 0; i < 6; i++) {
    const r = glowSprite(0xfff3b0, 1);
    r.material.rotation = (i / 6) * Math.PI;
    r.scale.set(3.6, .5, 1);
    r.position.copy(pos);
    scene.add(r);
    let t = 0;
    addAnim({ update(dt) {
      t += dt * 2.2;
      r.scale.set(3.6 * (1 + t), .5 * Math.max(.05, 1 - t), 1);
      r.material.opacity = Math.max(0, 1 - t);
      if (t >= 1) { scene.remove(r); return true; }
      return false;
    } });
  }
}
/* Zähler tickt Stück für Stück hoch – ein Klang pro Kristall */
function collectGems(count, done) {
  let i = 0;
  const step = () => {
    G.gems++; renderHUD(); sndGem(i); i++;
    if (i < count) setTimeout(step, 90); else if (done) done();
  };
  step();
}
