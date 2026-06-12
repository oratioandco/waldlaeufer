/* =====================================================================
   BEFEHLS-BLUMEN = Sinnentnehmendes Lesen
   Satz lesen, in Handlung übersetzen – KEIN Vorsprechen vor dem
   ersten Fehler. Ab Stufe 3 zweischrittig mit Reihenfolge-Logik.
   ===================================================================== */
import * as THREE from 'three';
import { addAnim } from '../engine/anims.js';
import { burst } from '../engine/effects.js';
import { G } from '../state.js';
import { activeTier } from '../learning/engine.js';
import { stationDone } from '../world/stations.js';
import { announce } from '../ui/feedback.js';
import { sndCard, sndChest, sndFizzle, tone } from '../audio/sfx.js';
import { sayGame } from '../audio/tts.js';
import { BEFEHL_VERBS, befehlOne, befehlTwo, befehlHelp } from '../learning/speech-lines.js';
import { spawnGemReward } from './reward.js';

export let befehlTargets = [];

export function startBefehl(st) {
  announce('FLÜSTERBLUMEN', 900);
  G.mode = 'befehl'; G.errors = 0; G.busy = false;
  befehlTargets = st.objs.flowers;
  const twoStep = activeTier >= 3 && Math.random() < .6;
  const shuffled = [...st.objs.colors].sort(() => Math.random() - .5);
  G.befehlSeq = twoStep ? [shuffled[0], shuffled[1]] : [shuffled[0]];
  G.befehlPos = 0;
  if (twoStep) {
    G.befehlSentence = befehlTwo(G.befehlSeq[0].name, G.befehlSeq[1].name);
  } else {
    const verb = BEFEHL_VERBS[Math.floor(Math.random() * BEFEHL_VERBS.length)];
    G.befehlSentence = befehlOne(verb, G.befehlSeq[0].name);
  }
  const sw = document.getElementById('spellWord');
  sw.innerHTML = `<div class="wslot wsentence">${G.befehlSentence}</div>`;
}
export function tapBefehl(flower) {
  const c = flower.userData.color;
  const want = G.befehlSeq[G.befehlPos];
  if (c.name === want.name) {
    sndCard();
    const headPos = flower.position.clone().add(new THREE.Vector3(0, flower.userData.headY * flower.scale.x, 0));
    burst(headPos, 12, [c.hex, 0xffffff]);
    G.befehlPos++;
    if (G.befehlPos >= G.befehlSeq.length) {
      G.busy = true;
      sndChest();
      announce('RICHTIG!', 800);
      sayGame('Richtig! Die Blumen stärken deine Wortmagie.');
      G.buff = 15;
      document.getElementById('buffTag').classList.add('on');
      document.getElementById('spellWord').innerHTML = '';
      G.mode = null; befehlTargets = [];
      /* Juwel steigt aus dem Blütenkopf auf */
      spawnGemReward(headPos.clone(), 3, () => setTimeout(stationDone, 250));
    } else {
      tone(880, .1, 'sine', .1);
    }
  } else {
    G.errors++;
    sndFizzle();
    burst(flower.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 6, [0x6a7a6a, c.hex]);
    if (G.errors === 1) {
      sayGame(G.befehlSentence, true); /* Scaffolding sofort */
    } else {
      const correct = befehlTargets.find(t2 => t2.userData.color.name === want.name);
      if (correct) {
        let t = 0; const b = correct.scale.x;
        addAnim({ update(dt) {
          t += dt * 5;
          correct.scale.setScalar(b + Math.sin(t) * .15 * Math.max(0, 1 - t / 15));
          if (t > 15) { correct.scale.setScalar(b); return true; } return false;
        } });
      }
      sayGame(befehlHelp(want.name), true); /* Scaffolding sofort */
    }
  }
}
