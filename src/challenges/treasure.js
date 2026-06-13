/* =====================================================================
   SCHATZKARTE – Lese-Minispiel (Roadmap 5a) = Sinnentnehmendes Lesen
   Anweisungssatz LESEN → richtigen Ort antippen → den Weg zum Schatz
   abgehen. Trainiert Sinnentnahme wie die Flüsterblumen.

   Therapie-Invarianten:
   • KEIN Vorsprechen des Hinweises vor dem ersten Fehler (Lesen ist die
     Aufgabe). 📯 ist eine freiwillige Hilfe. 1. Fehler → Hinweis wird
     vorgesprochen; 2. Fehler → der richtige Ort pulsiert (Scaffolding).
   • Falsches Antippen kostet NICHTS – einfach weiterprobieren.
   • Audio-First-Rahmen: Intro & Lob werden gesprochen.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rigPos, rigFocus, camPos } from '../engine/camera.js';
import { addAnim, easeInOut } from '../engine/anims.js';
import { glowSprite } from '../engine/textures.js';
import { G } from '../state.js';
import { spawnGemReward } from './reward.js';
import { sayStory, sayGame, stopSpeech } from '../audio/tts.js';
import { sndCard, sndTap, sndChest } from '../audio/sfx.js';
import { announce } from '../ui/feedback.js';
import { TREASURE_INTRO, TREASURE_WIN } from '../learning/speech-lines.js';

export let treasureTargets = [];
let marks = [], master = null, wanderer = null;
let base = new THREE.Vector3(), fwd = new THREE.Vector3(), lat = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
let savedRigPos = new THREE.Vector3(), savedRigFocus = new THREE.Vector3();
let onDoneCb = null;
let path = [], step = 0, errs = 0, busy = false;

/* Feste (Farbe+Objekt)-Orte → Hinweissätze sind ein kleiner, fixer Satz */
const LANDMARKS = [
  { key: 'pilz',     icon: '🍄', clue: 'Geh zum roten Pilz.' },
  { key: 'blume',    icon: '🌻', clue: 'Geh zur gelben Blume.' },
  { key: 'tanne',    icon: '🌲', clue: 'Geh zur grünen Tanne.' },
  { key: 'stein',    icon: '🪨', clue: 'Geh zum grauen Stein.' },
  { key: 'kristall', icon: '💎', clue: 'Geh zum blauen Kristall.' },
  { key: 'stamm',    icon: '🪵', clue: 'Geh zum braunen Stamm.' }
];
/* Streuung der Orte über die „Karte" (lateral, vorwärts) relativ zur Basis */
const SPOTS = [[-8, 1], [8, 0], [-5, -5], [5, -5], [0, 6], [0, -7]];

function emojiSprite(emoji, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.font = '92px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10;
  ctx.fillText(emoji, 64, 72);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(size, size, 1);
  return sp;
}

export function startTreasure(onDone) {
  if (master) return;
  onDoneCb = onDone || null;
  savedRigPos.copy(rigPos); savedRigFocus.copy(rigFocus);
  fwd.copy(rigFocus).sub(rigPos).setY(0);
  if (fwd.lengthSq() < .01) fwd.set(0, 0, -1);
  fwd.normalize();
  lat.set(-fwd.z, 0, fwd.x);
  base.copy(rigPos).addScaledVector(fwd, 11); base.y = 1.2;
  /* leichte Vogelperspektive → die Orte liegen wie auf einer Karte */
  rigPos.y = Math.max(rigPos.y, 5.4);
  rigFocus.set(base.x, .8, base.z);

  marks = []; treasureTargets = []; step = 0; errs = 0; busy = false;
  G.state = 'treasure'; G.mode = 'treasure'; G.busy = false;
  document.getElementById('campBar')?.classList.remove('on');
  document.getElementById('treaBar').classList.add('on');
  document.getElementById('treaHorn').onclick = () => sayGame(LANDMARKS[path[step]]?.clue || '');
  document.getElementById('treaQuit').onclick = () => finish(true);

  /* alle Orte platzieren; eine Reihenfolge von 5 als Weg wählen */
  LANDMARKS.forEach((lm, i) => {
    const p = base.clone().addScaledVector(lat, SPOTS[i][0]).addScaledVector(fwd, SPOTS[i][1]);
    p.y = 1.2;
    const sp = emojiSprite(lm.icon, 2.2);
    sp.position.copy(p);
    sp.userData.idx = i;
    sp.userData.baseY = p.y;
    scene.add(sp);
    marks.push({ sp, lm, pos: p, baseY: p.y });
    treasureTargets.push(sp);
  });
  const order = [...LANDMARKS.keys()].sort(() => Math.random() - .5);
  path = order.slice(0, 5);

  /* Wanderer-Marke startet nahe der Kamera */
  wanderer = glowSprite(0x9fe8ff, 1.4); wanderer.material.opacity = .9;
  wanderer.position.copy(rigPos).addScaledVector(fwd, 3); wanderer.position.y = 1;
  scene.add(wanderer);

  sayStory('narrator', TREASURE_INTRO);
  showClue();

  master = { _alive: true, update(dt) {
    if (!master || !master._alive) return true;
    /* sanftes Schweben der Orte + Wanderer-Puls */
    marks.forEach((m, i) => {
      m.sp.position.y = m.baseY + Math.sin((m._t = (m._t || 0) + dt) * 1.5 + i) * .12;
      if (m.pulse > 0) { m.pulse -= dt; m.sp.scale.setScalar(2.2 * (1 + Math.max(0, Math.sin(m.pulse * 12)) * .25)); }
    });
    wanderer.material.opacity = .7 + Math.sin((wanderer._t = (wanderer._t || 0) + dt) * 4) * .25;
    return false;
  } };
  addAnim(master);
}

function showClue() {
  errs = 0;
  const lm = LANDMARKS[path[step]];
  document.getElementById('treaClue').textContent = lm.clue;
  document.getElementById('treaProg').textContent = (step + 1) + ' / ' + path.length;
}

export function tapLandmark(sprite) {
  if (G.mode !== 'treasure' || busy) return;
  let o = sprite;
  while (o && o.userData.idx === undefined) o = o.parent;
  if (!o) return;
  const idx = o.userData.idx;
  if (idx === path[step]) {
    /* richtig: Wanderer geht hin, nächster Hinweis */
    busy = true; sndCard();
    const m = marks[idx];
    walkTo(m.pos.clone(), () => {
      step++;
      if (step >= path.length) { reachTreasure(m); return; }
      busy = false; showClue();
    });
  } else {
    /* falsch: KEIN Punktverlust. Gestuftes Scaffolding. */
    errs++;
    sndTap();
    const lm = LANDMARKS[path[step]];
    if (errs === 1) sayGame(lm.clue);                 /* 1. Fehler → vorlesen */
    else { marks[path[step]].pulse = 1.2; if (errs >= 2) sayGame(lm.clue); } /* 2. Fehler → Ort pulsiert */
  }
}

function walkTo(pos, done) {
  const from = wanderer.position.clone();
  pos.y = 1;
  let t = 0;
  addAnim({ update(dt) {
    t += dt / .7;
    const k = easeInOut(Math.min(1, t));
    wanderer.position.lerpVectors(from, pos, k);
    wanderer.position.y = 1 + Math.sin(k * Math.PI) * .6; /* kleiner Hüpfer */
    if (t >= 1) { done(); return true; }
    return false;
  } });
}

function reachTreasure(lastMark) {
  /* der letzte Ort wird zum Schatz */
  document.getElementById('treaBar').classList.remove('on');
  sndChest();
  announce('🪙 DER SCHATZ!', 1300);
  const chest = emojiSprite('🪙', 3);
  chest.position.copy(lastMark.pos); chest.position.y = 1.4;
  scene.add(chest);
  let t = 0;
  addAnim({ update(dt) {
    t += dt * 2; chest.scale.setScalar(3 * (1 + Math.sin(Math.min(Math.PI, t)) * .3));
    if (t >= Math.PI) return true; return false;
  } });
  sayStory('narrator', TREASURE_WIN);
  const p = lastMark.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
  spawnGemReward(p, 8, () => setTimeout(() => { scene.remove(chest); finish(false); }, 600));
}

function finish(early) {
  document.getElementById('treaBar').classList.remove('on');
  if (master) master._alive = false;
  master = null; busy = false;
  marks.forEach(m => scene.remove(m.sp)); marks = []; treasureTargets = [];
  if (wanderer) { scene.remove(wanderer); wanderer = null; }
  rigPos.copy(savedRigPos); rigFocus.copy(savedRigFocus);
  G.mode = 'camp'; G.state = 'camp'; G.busy = false;
  document.getElementById('campBar')?.classList.add('on');
  if (early) stopSpeech();
  if (onDoneCb) onDoneCb();
}
