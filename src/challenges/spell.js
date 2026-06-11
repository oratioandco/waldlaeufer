/* =====================================================================
   ZAUBERN & BRÜCKEN = Silbensynthese (Dekodieren)
   Adaptives Karten-Layout aus FOV/Aspect (Portrait mehrzeilig, dist 6,4;
   Landscape einzeilig, dist 4,4). Fehler kosten nie Punkte:
   1. Fehler → Wort vorsprechen, 2. Fehler → richtige Karte pulsiert + Silbe.
   ===================================================================== */
import * as THREE from 'three';
import { camera } from '../engine/renderer.js';
import { rigPos } from '../engine/camera.js';
import { addAnim } from '../engine/anims.js';
import { burst } from '../engine/effects.js';
import { G } from '../state.js';
import { nextWord, reportWord, TIER_WORDS, activeTier } from '../learning/engine.js';
import { lateral } from '../world/stations.js';
import { cards, makeCard, clearCards, removeCard } from './cards.js';
import { castSpell } from './combat.js';
import { openBridge } from './bridge.js';
import { sndCard, sndFizzle } from '../audio/sfx.js';
import { sayGame } from '../audio/tts.js';
import { zauberePhrase, syllableRead } from '../learning/speech-lines.js';
import { saveActive } from '../meta/save.js';

export function startWordChallenge(mode) {
  G.mode = mode;
  G.word = nextWord();
  G.idx = 0; G.errors = 0; G.busy = false;
  clearCards();

  const sw = document.getElementById('spellWord');
  sw.innerHTML = '';
  G.word.s.forEach((syl, i) => {
    const d = document.createElement('div');
    d.className = 'wslot'; d.dataset.i = i; d.textContent = syl;
    sw.appendChild(d);
  });

  const items = G.word.s.map((s, i) => ({ s, i }));
  /* Distraktoren nach BEHERRSCHUNG, nicht nach Gebiet */
  const nDis = Math.min(2, Math.max(0, activeTier - 1));
  const pool = Object.values(TIER_WORDS).flat().filter(w => w.w !== G.word.w)
    .flatMap(w => w.s).filter(s => !G.word.s.includes(s));
  for (let k = 0; k < nDis && pool.length; k++) {
    items.push({ s: pool.splice(Math.floor(Math.random() * pool.length), 1)[0], i: -1 });
  }
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }

  /* Adaptives Layout: passt Reihen & Abstand an Sichtfeld an */
  const st = G.stations[G.stIdx];
  const lat = lateral(st.dir);
  const portrait = innerHeight > innerWidth;
  const dist = portrait ? 6.4 : 4.4;
  const vFov = camera.fov * Math.PI / 180;
  const hHalf = Math.tan(vFov / 2) * (innerWidth / innerHeight) * dist * 0.8;
  const spacing = 2.1;
  const perRow = Math.max(2, Math.min(6, Math.floor((hHalf * 2) / spacing) + 1));
  const base = rigPos.clone().addScaledVector(st.dir, dist);
  items.forEach((o, k) => {
    const row = Math.floor(k / perRow);
    const inRow = Math.min(perRow, items.length - row * perRow);
    const col = k % perRow;
    const off = inRow === 1 ? 0 : (col - (inRow - 1) / 2) * Math.min(spacing, (hHalf * 2) / (inRow - 1));
    const r = makeCard(o.s, o.i);
    r.userData.baseY = 1.0 + row * 1.45;
    r.position.copy(base).addScaledVector(lat, off);
    r.position.y = r.userData.baseY;
  });

  setTimeout(() => sayGame(zauberePhrase(G.word.w)), 320);
}
export function speakSpell() {
  if (G.mode === 'befehl' && G.befehlSentence) { sayGame(G.befehlSentence); return; }
  if (!G.word) return;
  sayGame(syllableRead(G.word));
}

export function tapCard(r) {
  const u = r.userData;
  if (u.correctIndex === G.idx) {
    u.dead = true;
    sndCard();
    sayGame(u.syl);
    const slot = document.querySelector(`.wslot[data-i="${G.idx}"]`);
    if (slot) slot.classList.add('lit', G.idx % 2 === 0 ? 'a' : 'b');
    const start = r.position.clone();
    const dest = rigPos.clone().add(new THREE.Vector3(0, -2.2, 0));
    let t = 0;
    addAnim({ update(dt) {
      t += dt * 2.6; const k = Math.min(1, t);
      r.position.lerpVectors(start, dest, k);
      r.scale.setScalar(1 - k * .9);
      if (k >= 1) { removeCard(r); return true; } return false;
    } });
    G.idx++;
    if (G.idx >= G.word.s.length) {
      G.busy = true;
      reportWord(G.word.w, G.errors === 0);
      saveActive(); /* Lernstand nach jedem Wort sichern */
      setTimeout(() => { G.mode === 'gate' ? openBridge() : castSpell(); }, 420);
    }
  } else {
    G.errors++;
    sndFizzle();
    burst(r.position.clone(), 6, [0x46d68a, 0xffffff], true);
    const ox = r.position.clone(); let t = 0;
    addAnim({ update(dt) {
      t += dt * 22;
      r.position.x = ox.x + Math.sin(t) * .14 * Math.max(0, 1 - t / 13);
      if (t > 13) { r.position.copy(ox); return true; } return false;
    } });
    if (G.errors === 1) {
      sayGame(G.word.w);
    } else {
      const correct = cards.find(b => !b.userData.dead && b.userData.correctIndex === G.idx);
      if (correct) {
        let t = 0; const base = correct.scale.x;
        addAnim({ update(dt) {
          t += dt * 5;
          correct.scale.setScalar(base + Math.sin(t) * .16 * Math.max(0, 1 - t / 15));
          if (t > 15) { correct.scale.setScalar(base); return true; } return false;
        } });
        sayGame(G.word.s[G.idx]);
      }
    }
  }
}
