/* ---------- Brücke: erfolgreiches Tor-Wort lässt Planken wachsen ---------- */
import * as THREE from 'three';
import { addAnim, easeOut } from '../engine/anims.js';
import { burst } from '../engine/effects.js';
import { G } from '../state.js';
import { stationDone } from '../world/stations.js';
import { sndBridge } from '../audio/sfx.js';
import { sayGame } from '../audio/tts.js';
import { spawnGemReward } from './reward.js';

export function openBridge() {
  const st = G.stations[G.stIdx];
  sndBridge();
  sayGame('Die Brücke wächst!');
  burst(st.pos.clone().add(new THREE.Vector3(0, .6, 0)), 14, [0x8a5f33, 0xb6f7c2]);
  st.objs.planks.forEach((plank, k) => {
    let t = -k * .18;
    addAnim({ update(dt) {
      t += dt * 1.6;
      if (t < 0) return false;
      const kk = easeOut(Math.min(1, t));
      plank.position.y = -.8 + kk * .93;
      if (t >= 1) { plank.position.y = .13; return true; } return false;
    } });
  });
  G.word = null; G.mode = null;
  document.getElementById('spellWord').innerHTML = '';
  /* Reward erst, wenn die Brücke steht: Juwel steigt aus den Planken auf */
  setTimeout(() => spawnGemReward(st.pos.clone().add(new THREE.Vector3(0, .4, 0)), 2,
    () => setTimeout(stationDone, 250)), 950);
}
