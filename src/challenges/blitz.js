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
import { M, setMobHp, flashModel, tintRage, solidify } from '../creatures/mob.js';
import { stationDone } from '../world/stations.js';
import { renderHearts } from '../ui/hud.js';
import { announce, flyText, flashRed } from '../ui/feedback.js';
import { spawnGemReward } from './reward.js';
import { ovOn } from '../ui/overlays.js';
import { sndChest, sndBlock, sndHurt, sndHeart, sndTap, sndGrowl, sndBoom, tone } from '../audio/sfx.js';
import { sayGame, sayStory } from '../audio/tts.js';
import { shieldWas, BOSS_HIT } from '../learning/speech-lines.js';
import { UI_LINES } from '../story/content.js';
import { startWordChallenge } from './spell.js';
import { killMob } from './combat.js';
import { rigPos } from '../engine/camera.js';

let shieldItem = null, parryTimer = null, parryDeadline = null, parryCtx = 'fight';

export function startChest() {
  if (G.sandbox) return; /* Dev-Sandbox: keine Truhe */
  announce('SCHATZTRUHE', 900);
  sayGame('Eine Truhe! Merk dir das Schlüsselwort.');
  setTimeout(() => startBlitz('chest'), 900);
}
export function startBlitz(ctx) {
  parryCtx = ctx;
  G.busy = true;
  shieldItem = nextShield();
  const ov = document.getElementById('parry');
  ov.classList.toggle('chest', ctx === 'chest');
  document.getElementById('parryTag').textContent =
    ctx === 'chest' ? '🗝 Schlüsselwort!' : '⚠ Angriff – Abwehrwort!';
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
    /* Blitz-Timer wird in höheren Runden schneller (Mechanik-Tempo);
       in Boss-Phase 2 nochmal um 20% */
    const round = Math.floor((G.floor - 1) / 6);
    let T = Math.max(3500, 6000 - round * 700);
    if (G.mob && G.mob.boss && G.mob.phase2) T = Math.round(T * .8);
    parryDeadline = Date.now() + T;
    const total = T;
    parryTimer = setInterval(() => {
      const left = Math.max(0, parryDeadline - Date.now());
      document.getElementById('parryRingFill').style.width = (left / total * 100) + '%';
      if (left <= 0) { clearInterval(parryTimer); blitzFail(true); }
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
let failWasTimeout = false;
function blitzFail(timedOut = false) {
  failWasTimeout = timedOut;
  clearInterval(parryTimer);
  shieldStats[shieldItem.w].fails++;
  document.querySelectorAll('.pbtn').forEach(b => b.style.pointerEvents = 'none');
  [...document.querySelectorAll('.pbtn')].find(b => b.textContent === shieldItem.w)?.classList.add('ok');
  sayGame(shieldWas(shieldItem.w), true); /* Auflösung sofort */
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
  } else if (failWasTimeout) {
    /* THERAPIE: Zeitablauf kostet NIE ein Herz – Lesetempo ist genau
       die LRS-Schwäche. Der Schild hält gerade noch; es fehlt nur
       der Treffer-Bonus. Nur aktiv falsche Antworten kosten ein Herz. */
    announce('PUH – DER SCHILD HÄLT!', 1000);
    setTimeout(() => startWordChallenge('spell'), 900);
  } else {
    /* SCHATTEN-HIEB: der Gegner ATTACKIERT (externalisiert – nie „du hast
       falsch gelesen"). Inszeniert als Manga-Einschlag in vier Phasen:
       AUSHOLEN (Geist bäumt sich zurück) → ZUSCHLAGEN (schneller Satz nach
       vorn, der diffuse Schatten ERSTARRT zur harten Silhouette) →
       EINFRIEREN (Zeitlupe: Speedlines, eingefrorene Pose) → ZURÜCK. */
    shadowStrike();
  }
}

/* Manga-Einschlag-Choreografie. updateAnims läuft in Echtzeit (raw dt),
   während G.timeScale die UMGEBUNG in Zeitlupe versetzt → der erstarrte
   Geist wirkt eingefroren, die Welt kriecht. */
const WIND = .40, STRIKE = .12, FREEZE = .62, RECOVER = .42;
export function shadowStrike() {
  const grp = M.group;
  const ss = document.getElementById('shadowSlash');
  const mi = document.getElementById('mangaImpact');
  let hit = false;
  sndGrowl(); /* tiefes Knurren beim Ausholen */

  const impact = () => {
    flashRed(); screenShake(3.0); sndBoom(); sndHurt();
    if (ss) { ss.classList.remove('hit'); void ss.offsetWidth; ss.classList.add('hit'); }
    if (mi) { mi.classList.remove('on'); void mi.offsetWidth; mi.classList.add('on'); }
    announce('🌑 SCHATTEN-HIEB!', 1100);
    if (G.mob && G.mob.boss) sayStory('boss', BOSS_HIT, true); /* nur der Boss höhnt */
    G.timeScale = .16; /* Welt in Zeitlupe */
    G.hearts--; renderHearts(); sndHeart();
  };

  if (grp) {
    const oz = grp.position.clone();
    const toward = new THREE.Vector3().subVectors(rigPos, oz); toward.y = 0;
    if (toward.lengthSq() < 1e-4) toward.set(0, 0, 1); toward.normalize();
    const back = oz.clone().addScaledVector(toward, -1.0); back.y = oz.y + .9;   /* aufgebäumt */
    const lunge = oz.clone().lerp(rigPos, .6); lunge.y = oz.y - .5;              /* Satz nach vorn-unten */
    addAnim({ t: 0, update(dt) {
      this.t += dt; const t = this.t;
      if (t < WIND) {                                   /* AUSHOLEN */
        const k = easeOut(t / WIND);
        grp.position.lerpVectors(oz, back, k);
        grp.scale.setScalar(1 + k * .12);
        tintRage(k * .7);
      } else if (t < WIND + STRIKE) {                   /* ZUSCHLAGEN */
        const e = ((t - WIND) / STRIKE) ** 2;           /* ease-in: schnellt los */
        grp.position.lerpVectors(back, lunge, e);
        grp.scale.setScalar(1.12 + e * .28);
        solidify(e); tintRage(.7 + e * .3); flashModel(e * .8);
      } else if (t < WIND + STRIKE + FREEZE) {          /* EINFRIEREN (Zeitlupe) */
        if (!hit) { hit = true; impact(); }
        const f = (t - WIND - STRIKE) / FREEZE;
        grp.position.copy(lunge); grp.position.x += Math.sin(t * 42) * .015; /* feines Zittern */
        grp.scale.setScalar(1.4);
        solidify(1); tintRage(1);
        flashModel(.12 + (1 - f) * .6);                 /* heller Anschlag → dunkle solide Silhouette */
      } else if (t < WIND + STRIKE + FREEZE + RECOVER) { /* ZURÜCK */
        if (G.timeScale !== 1) { G.timeScale = 1; if (mi) mi.classList.remove('on'); }
        const k = easeOut((t - WIND - STRIKE - FREEZE) / RECOVER);
        grp.position.lerpVectors(lunge, oz, k);
        grp.scale.setScalar(1.4 - k * .4);
        solidify(1 - k); tintRage(1 - k); flashModel((1 - k) * .12);
      } else {
        grp.position.copy(oz); grp.scale.setScalar(1);
        solidify(0); tintRage(0); flashModel(0);
        G.timeScale = 1; if (mi) mi.classList.remove('on');
        return true;
      }
      return false;
    } });
  } else {
    impact(); setTimeout(() => { G.timeScale = 1; if (mi) mi.classList.remove('on'); }, 600);
  }

  /* Auflösung nach der vollen Sequenz (Echtzeit – G.timeScale betrifft nur
     die Umgebungs-Animation, nicht setTimeout) */
  const total = WIND + STRIKE + FREEZE + RECOVER;
  setTimeout(() => {
    G.timeScale = 1; /* Sicherheitsnetz: Zeitlupe nie hängen lassen */
    if (G.hearts <= 0) { ovOn('deadOv'); sayStory('narrator', UI_LINES.dead); }
    else startWordChallenge('spell');
  }, total * 1000 + 140);
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
