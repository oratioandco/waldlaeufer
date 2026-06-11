/* ---------- 3D-Effekte: Partikel-Bursts, Zauber-Orb ---------- */
import * as THREE from 'three';
import { scene } from './renderer.js';
import { QUALITY, qTier } from './quality.js';
import { glowSprite } from './textures.js';
import { rigPos } from './camera.js';
import { addAnim } from './anims.js';
import { sndCast } from '../audio/sfx.js';

let shards = [];

export function burst(pos, n, colors, glow = true) {
  n = Math.max(3, Math.round(n * (QUALITY[qTier].extras ? 1 : .4)));
  for (let i = 0; i < n; i++) {
    let c;
    if (glow && i % 2 === 0) {
      c = glowSprite(colors[i % colors.length], .7 + Math.random() * .7);
    } else {
      c = new THREE.Mesh(new THREE.TetrahedronGeometry(.16 + Math.random() * .14),
        new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    }
    c.position.copy(pos);
    c.userData.v = new THREE.Vector3((Math.random() - .5) * 9, 2 + Math.random() * 7, (Math.random() - .5) * 9);
    c.userData.life = .9 + Math.random() * .7;
    scene.add(c); shards.push(c);
  }
}
export function shootSpell(target, onHit) {
  sndCast();
  const orb = new THREE.Group();
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0xeafff2 })));
  orb.add(glowSprite(0x46d68a, 2.4));
  const start = rigPos.clone().add(new THREE.Vector3(0, -1.4, 0));
  orb.position.copy(start); scene.add(orb);
  let t = 0, trailT = 0;
  addAnim({ update(dt) {
    t += dt * 2.1; const k = Math.min(1, t);
    orb.position.lerpVectors(start, target, k);
    orb.position.y += Math.sin(k * Math.PI) * 1.7;
    trailT += dt;
    if (trailT > .03 && QUALITY[qTier].extras) {
      trailT = 0;
      const tr = glowSprite(0x46d68a, 1.0);
      tr.position.copy(orb.position);
      tr.userData.v = new THREE.Vector3(0, 0, 0); tr.userData.life = .32;
      scene.add(tr); shards.push(tr);
    }
    if (k >= 1) { scene.remove(orb); onHit(); return true; }
    return false;
  } });
}
export function updateShards(dt) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const c = shards[i];
    c.userData.v.y -= 14 * dt;
    c.position.addScaledVector(c.userData.v, dt);
    if (c.rotation) { c.rotation.x += dt * 8; c.rotation.z += dt * 6; }
    c.userData.life -= dt;
    if (c.material && c.material.opacity !== undefined && c.userData.life < .4)
      c.material.opacity = Math.max(0, c.userData.life / .4);
    if (c.userData.life <= 0) { scene.remove(c); shards.splice(i, 1); }
  }
}
