/* =====================================================================
   GLÜHWÜRMCHEN-JAGD – reines Belohnungs-Minispiel OHNE Wortbezug (5b)
   Bewusst KEINE Lese-Aufgabe: einfach Spaß & Geschick als Belohnung.
   Glühwürmchen treiben durch die Lichtung, antippen zum Fangen.
   Schnelle Treffer hintereinander = Combo (×2…×5). 60 Sekunden,
   danach Kristalle nach Fang-Zahl. Audio-First: Erzähler erklärt &
   lobt; keinerlei Lese-Voraussetzung.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rigPos, rigFocus, camPos } from '../engine/camera.js';
import { addAnim } from '../engine/anims.js';
import { glowSprite } from '../engine/textures.js';
import { G } from '../state.js';
import { spawnGemReward } from './reward.js';
import { sayStory, stopSpeech } from '../audio/tts.js';
import { sndGem, sndTap, sndWin } from '../audio/sfx.js';
import { announce } from '../ui/feedback.js';

export let fireflyTargets = [];
let flies = [], master = null;
let base = new THREE.Vector3(), fwd = new THREE.Vector3(), lat = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
let savedRigPos = new THREE.Vector3(), savedRigFocus = new THREE.Vector3();
let onDoneCb = null;
let timeLeft = 0, caught = 0, score = 0, combo = 0, lastCatch = 0, spawnAcc = 0, elapsed = 0;

const DURATION = 60;
const SPAN = 9, VSPAN = 3.4, DEPTH = 4;
const DIST = 8;

export function startFireflies(onDone) {
  if (master) return;
  onDoneCb = onDone || null;
  savedRigPos.copy(rigPos); savedRigFocus.copy(rigFocus);
  fwd.copy(rigFocus).sub(rigPos).setY(0);
  if (fwd.lengthSq() < .01) fwd.set(0, 0, -1);
  fwd.normalize();
  lat.set(-fwd.z, 0, fwd.x);
  base.copy(rigPos).addScaledVector(fwd, DIST); base.y = 2.4;
  rigPos.y = Math.max(rigPos.y, 3.4);
  rigFocus.copy(base);

  flies = []; fireflyTargets = [];
  timeLeft = DURATION; caught = 0; score = 0; combo = 0; lastCatch = -10; spawnAcc = 0; elapsed = 0;
  G.state = 'fireflies'; G.mode = 'fireflies'; G.busy = false;
  document.getElementById('campBar')?.classList.remove('on');
  document.getElementById('ffBar').classList.add('on');
  document.getElementById('ffQuit').onclick = () => finish(true);
  renderHud();

  sayStory('narrator', 'Glühwürmchen-Jagd! Tipp so viele wie du kannst, schnell hintereinander für mehr Punkte!');

  /* gleich ein paar zum Start */
  for (let i = 0; i < 6; i++) spawnFly();

  master = { _alive: true, update(dt) {
    if (!master || !master._alive) return true;
    elapsed += dt; spawnAcc += dt;
    timeLeft = Math.max(0, DURATION - elapsed);
    /* Combo verfällt nach 1,6 s ohne Fang */
    if (combo > 0 && elapsed - lastCatch > 1.6) { combo = 0; renderHud(); }
    /* nachspawnen, Zielmenge ~7–9 (steigt leicht über die Zeit) */
    const want = 7 + Math.floor(elapsed / 20);
    if (spawnAcc > .5 && flies.length < want) { spawnAcc = 0; spawnFly(); }
    /* bewegen + Lebenszyklus */
    for (let i = flies.length - 1; i >= 0; i--) {
      const f = flies[i];
      f.age += dt;
      f.bob += dt * f.bobSpd;
      /* seitlich treiben und am Korridorrand abprallen */
      f.off += f.vx * dt;
      if (f.off > SPAN) { f.off = SPAN; f.vx = -Math.abs(f.vx); }
      else if (f.off < -SPAN) { f.off = -SPAN; f.vx = Math.abs(f.vx); }
      f.depth += f.vz * dt;
      if (Math.abs(f.depth) > DEPTH) f.vz *= -1;
      const p = base.clone()
        .addScaledVector(lat, f.off)
        .addScaledVector(fwd, f.depth)
        .add(up.clone().multiplyScalar(f.h + Math.sin(f.bob) * .5));
      f.spr.position.copy(p);
      /* Ein-/Ausblenden */
      const fin = Math.min(1, f.age / .4);
      const fout = Math.min(1, Math.max(0, (f.life - f.age) / .7));
      f.spr.material.opacity = .9 * fin * fout * (f.gold ? 1 : .85);
      const pulse = 1 + Math.sin(f.age * 6) * .12;
      f.spr.scale.setScalar(f.size * pulse);
      if (f.age >= f.life) removeFly(f);
    }
    if (timeLeft <= 0) { finish(false); return true; }
    renderTimer();
    return false;
  } };
  addAnim(master);
}

function spawnFly() {
  const gold = Math.random() < .14;
  const size = gold ? 1.05 : .8;
  const spr = glowSprite(gold ? 0xffe27a : 0xaaffd0, size);
  spr.material.opacity = 0;
  spr.userData.fly = true;
  scene.add(spr);
  const f = {
    spr, gold, size,
    off: (Math.random() * 2 - 1) * SPAN * .85,
    depth: (Math.random() - .5) * DEPTH,
    h: (Math.random() - .5) * VSPAN,
    vx: (Math.random() - .5) * 1.6, vz: (Math.random() - .5) * 1.0,
    bob: Math.random() * 6.28, bobSpd: 1.5 + Math.random(),
    age: 0, life: 3.2 + Math.random() * 2.2
  };
  flies.push(f); fireflyTargets.push(spr);
}
function removeFly(f) {
  scene.remove(f.spr);
  flies = flies.filter(x => x !== f);
  fireflyTargets = fireflyTargets.filter(s => s !== f.spr);
}

export function tapFirefly(spr) {
  if (G.mode !== 'fireflies') return;
  const f = flies.find(x => x.spr === spr);
  if (!f) return;
  /* Combo: schnelle Treffer hintereinander */
  if (elapsed - lastCatch <= 1.6) combo = Math.min(5, combo + 1); else combo = 1;
  lastCatch = elapsed;
  const mult = combo;
  const val = (f.gold ? 3 : 1) * mult;
  score += val; caught++;
  sndGem(Math.min(5, combo - 1));
  /* Funken-Aufstieg an der Fangstelle */
  const p = f.spr.position.clone();
  burstSpark(p, f.gold);
  if (mult >= 2) announce('×' + mult + (f.gold ? '  ✨GOLD' : ''), 650);
  removeFly(f);
  renderHud();
}
function burstSpark(p, gold) {
  for (let i = 0; i < (gold ? 8 : 5); i++) {
    const s = glowSprite(gold ? 0xffe27a : 0xbfffe0, .35 + Math.random() * .3);
    s.position.copy(p);
    scene.add(s);
    const v = new THREE.Vector3((Math.random() - .5) * 3, 1.5 + Math.random() * 2, (Math.random() - .5) * 3);
    let t = 0;
    addAnim({ update(dt) {
      t += dt * 1.8;
      s.position.addScaledVector(v, dt);
      s.material.opacity = Math.max(0, 1 - t);
      s.scale.setScalar(Math.max(.05, (.4) * (1 - t)));
      if (t >= 1) { scene.remove(s); return true; }
      return false;
    } });
  }
}

function renderHud() {
  document.getElementById('ffScore').textContent = '✨ ' + caught;
  const c = document.getElementById('ffCombo');
  c.textContent = combo >= 2 ? '×' + combo : '';
  c.classList.toggle('hot', combo >= 3);
}
function renderTimer() {
  document.getElementById('ffTime').textContent = Math.ceil(timeLeft) + 's';
}

function finish(early) {
  document.getElementById('ffBar').classList.remove('on');
  if (master) master._alive = false;
  master = null;
  flies.forEach(f => scene.remove(f.spr));
  flies = []; fireflyTargets = [];
  rigPos.copy(savedRigPos); rigFocus.copy(savedRigFocus);
  G.mode = 'camp'; G.state = 'camp'; G.busy = false;
  document.getElementById('campBar')?.classList.add('on');
  if (early) { stopSpeech(); if (onDoneCb) onDoneCb(); return; }
  /* Kristalle nach Fang-Zahl (sanfte Kurve, gedeckelt) */
  const gems = Math.max(3, Math.min(30, Math.round(score / 4)));
  sndWin();
  announce('✨ ' + caught + ' gefangen!', 1400);
  sayStory('narrator', caught >= 25 ? 'Wahnsinn, was für eine Jagd!' : 'Toll gefangen!');
  const p = camPos.clone().addScaledVector(fwd, 6).add(new THREE.Vector3(0, .5, 0));
  spawnGemReward(p, gems, () => { if (onDoneCb) onDoneCb(); });
}
