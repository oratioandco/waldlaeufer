/* =====================================================================
   TRUHE & SCHILD = Blitzlesen (Automatisierung des Sichtwortschatzes)
   Häufige Funktionswörter + visuell ähnliche Distraktoren.
   Feedback eindeutig: Erfolg heißt „RICHTIG!".
   ===================================================================== */
import * as THREE from 'three';
import { screenShake } from '../engine/camera.js';
import { addAnim, easeOut } from '../engine/anims.js';
import { burst } from '../engine/effects.js';
import { G } from '../state.js';
import { nextShield, shieldStats } from '../learning/engine.js';
import { M, setMobHp } from '../creatures/mob.js';
import { stationDone } from '../world/stations.js';
import { renderHearts } from '../ui/hud.js';
import { announce, flyText, flashRed } from '../ui/feedback.js';
import { spawnGemReward } from './reward.js';
import { ovOn } from '../ui/overlays.js';
import { sndChest, sndBlock, sndHurt, sndHeart, sndTap, tone } from '../audio/sfx.js';
import { sayGame, sayStory } from '../audio/tts.js';
import { shieldWas } from '../learning/speech-lines.js';
import { UI_LINES } from '../story/content.js';
import { startWordChallenge } from './spell.js';
import { killMob } from './combat.js';
import { rigPos } from '../engine/camera.js';

let shieldItem = null, parryTimer = null, parryDeadline = null, parryCtx = 'fight';

export function startChest() {
  announce('SCHATZTRUHE', 900);
  sayGame('Eine Truhe! Merk dir das Schloss-Wort.');
  setTimeout(() => startBlitz('chest'), 900);
}
export function startBlitz(ctx) {
  parryCtx = ctx;
  G.busy = true;
  shieldItem = nextShield();
  const ov = document.getElementById('parry');
  ov.classList.toggle('chest', ctx === 'chest');
  document.getElementById('parryTag').textContent =
    ctx === 'chest' ? '🔒 Schloss-Wort!' : '⚠ Angriff – Schildwort!';
  const w = document.getElementById('parryWord');
  const c = document.getElementById('parryChoices');
  c.innerHTML = ''; w.textContent = shieldItem.w;
  ov.classList.add('on');
  sayGame(shieldItem.w);
  tone(980, .1, 'sine', .1);
  document.getElementById('parryRingFill').style.width = '100%';

  setTimeout(() => {
    w.textContent = '✦';
    const opts = [shieldItem.w, ...shieldItem.d];
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    opts.forEach(o => {
      const b = document.createElement('button');
      b.className = 'pbtn'; b.textContent = o;
      b.addEventListener('pointerdown', () => { sndTap(); blitzAnswer(b, o); });
      c.appendChild(b);
    });
    const T = 6000; parryDeadline = Date.now() + T;
    parryTimer = setInterval(() => {
      const left = Math.max(0, parryDeadline - Date.now());
      document.getElementById('parryRingFill').style.width = (left / T * 100) + '%';
      if (left <= 0) { clearInterval(parryTimer); blitzFail(); }
    }, 80);
  }, 1300);
}
function blitzAnswer(btn, choice) {
  clearInterval(parryTimer);
  document.querySelectorAll('.pbtn').forEach(b => b.style.pointerEvents = 'none');
  if (choice === shieldItem.w) {
    btn.classList.add('ok');
    if (parryCtx === 'chest') { sndChest(); announce('RICHTIG!', 900); }
    else { sndBlock(); announce('RICHTIG! 🛡', 900); }
    sayGame(parryCtx === 'chest' ? 'Richtig! Die Truhe öffnet sich.' : 'Richtig! Du hast den Angriff abgewehrt.');
    setTimeout(() => { closeBlitz(); blitzSuccess(); }, 650);
  } else {
    btn.classList.add('no');
    shieldStats[shieldItem.w].fails++;
    blitzFail();
  }
}
function blitzFail() {
  clearInterval(parryTimer);
  shieldStats[shieldItem.w].fails++;
  document.querySelectorAll('.pbtn').forEach(b => b.style.pointerEvents = 'none');
  [...document.querySelectorAll('.pbtn')].find(b => b.textContent === shieldItem.w)?.classList.add('ok');
  sayGame(shieldWas(shieldItem.w));
  setTimeout(() => { closeBlitz(); blitzFailed(); }, 1400);
}
function closeBlitz() {
  document.getElementById('parry').classList.remove('on');
  document.querySelectorAll('.pbtn').forEach(b => b.style.pointerEvents = '');
}
function blitzSuccess() {
  if (parryCtx === 'chest') {
    openChest(G.stations[G.stIdx], 5);
  } else {
    G.mob.hp -= 12; setMobHp();
    flyText(M.group.position.clone().add(new THREE.Vector3(0, 2.7, 0)), '-12', '#46d68a', 26);
    burst(M.group.position.clone().add(new THREE.Vector3(0, .4, 0)), 10, [0x46d68a, 0xb6f7c2]);
    if (G.mob.hp <= 0) killMob(); else setTimeout(() => startWordChallenge('spell'), 400);
  }
}
function blitzFailed() {
  if (parryCtx === 'chest') {
    openChest(G.stations[G.stIdx], 2);
  } else {
    sndHurt(); flashRed(); screenShake(1.2);
    if (M.group) {
      const grp = M.group;
      const oz = grp.position.clone();
      const lunge = oz.clone().lerp(rigPos, .35);
      addAnim({ t: 0, update(dt) {
        this.t += dt * 5;
        const k = Math.sin(Math.min(Math.PI, this.t));
        grp.position.lerpVectors(oz, lunge, k);
        if (this.t >= Math.PI) { grp.position.copy(oz); return true; } return false;
      } });
    }
    G.hearts--; renderHearts(); sndHeart();
    if (G.hearts <= 0) {
      setTimeout(() => { ovOn('deadOv'); sayStory('narrator', UI_LINES.dead); }, 700);
    }
    else setTimeout(() => startWordChallenge('spell'), 900);
  }
}
function openChest(st, g) {
  sndChest();
  if (st.objs.lid) {
    const lid = st.objs.lid; let t = 0;
    addAnim({ update(dt) {
      t += dt * 2;
      lid.rotation.x = -easeOut(Math.min(1, t)) * 1.9;
      if (t >= 1) return true; return false;
    } });
  }
  burst(st.pos.clone().add(new THREE.Vector3(0, 1, 0)), 18, [0xffd34a, 0xffe9a3, 0xffffff]);
  spawnGemReward(st.pos.clone().add(new THREE.Vector3(0, .7, 0)), g,
    () => setTimeout(stationDone, 250));
}
