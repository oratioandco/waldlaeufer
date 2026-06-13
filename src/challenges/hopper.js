/* =====================================================================
   PILZ-HÜPFER – reines Belohnungs-Minispiel OHNE Wortbezug (5b)
   Timing-Geschick: Pilze treiben durch die Lichtung. Tippe im richtigen
   Moment, wenn ein Pilz die Hüpf-Zone (Mitte) erreicht – der Hüpfer
   springt darauf. Je näher an der Mitte, desto mehr Punkte (PERFEKT!).
   Treffer in Folge = Kette ×2…×5. 60 Sekunden, danach Kristalle.
   Audio-First: Erzähler erklärt & lobt; keinerlei Lesehürde.
   Daneben/verpasst kostet NICHTS – die Kette beginnt einfach neu.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rigPos, rigFocus, camPos } from '../engine/camera.js';
import { addAnim, easeOut } from '../engine/anims.js';
import { glowSprite } from '../engine/textures.js';
import { toonMat } from '../engine/materials.js';
import { G } from '../state.js';
import { spawnGemReward } from './reward.js';
import { sayStory, stopSpeech } from '../audio/tts.js';
import { sndCard, sndTap, sndWin, sndBlock } from '../audio/sfx.js';
import { announce } from '../ui/feedback.js';

let mushrooms = [], master = null, zoneRing = null, zoneDisc = null, hopper = null;
let base = new THREE.Vector3(), fwd = new THREE.Vector3(), lat = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
let savedRigPos = new THREE.Vector3(), savedRigFocus = new THREE.Vector3();
let onDoneCb = null;
let timeLeft = 0, score = 0, chain = 0, bestChain = 0, hits = 0, spawnAcc = 0, elapsed = 0;
let hopT = 0, lastChainT = -10;

/* Dev-Hook für automatisierte Tests */
export const _dbg = { mushrooms: () => mushrooms };

const DURATION = 60;
const DIST = 9;
const SPAN = 9.5;        /* Pilze treiben von -SPAN bis +SPAN, Zone bei 0 */
const WIN_PERFEKT = .7, WIN_GUT = 1.7, WIN_OK = 2.7;

function emojiSprite(emoji, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.font = '96px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10;
  ctx.fillText(emoji, 64, 72);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(size, size, 1);
  return sp;
}

export function startHopper(onDone) {
  if (master) return;
  onDoneCb = onDone || null;
  savedRigPos.copy(rigPos); savedRigFocus.copy(rigFocus);
  fwd.copy(rigFocus).sub(rigPos).setY(0);
  if (fwd.lengthSq() < .01) fwd.set(0, 0, -1);
  fwd.normalize();
  lat.set(-fwd.z, 0, fwd.x);
  base.copy(rigPos).addScaledVector(fwd, DIST); base.y = 1.25;
  rigPos.y = Math.max(rigPos.y, 3.4);
  rigFocus.set(base.x, base.y + .4, base.z);

  mushrooms = [];
  timeLeft = DURATION; score = 0; chain = 0; bestChain = 0; hits = 0; spawnAcc = 0; elapsed = 0; hopT = 0;
  G.state = 'hopper'; G.mode = 'hopper'; G.busy = false;
  document.getElementById('campBar')?.classList.remove('on');
  document.getElementById('hopBar').classList.add('on');
  document.getElementById('hopQuit').onclick = () => finish(true);
  renderHud();

  /* Hüpf-Zone: gut sichtbarer Boden-Ring (RICHTIGER Moment = Pilz hier) */
  zoneDisc = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 40),
    toonMat({ color: 0xffd34a, transparent: true, opacity: .8, side: THREE.DoubleSide }));
  zoneDisc.rotation.x = -Math.PI / 2;
  zoneDisc.position.set(base.x, .06, base.z);
  scene.add(zoneDisc);
  zoneRing = glowSprite(0xffe27a, 3); zoneRing.material.opacity = .55;
  zoneRing.position.copy(base);
  scene.add(zoneRing);
  /* Der Hüpfer (Begleiter-Symbol, sonst Frosch) über der Zone */
  hopper = emojiSprite(G.companion?.icon || '🐸', 2);
  scene.add(hopper);

  sayStory('narrator', 'Pilz-Hüpfer! Tipp im richtigen Moment, wenn ein Pilz in der Mitte ist – je genauer, desto mehr Punkte!');

  master = { _alive: true, update(dt) {
    if (!master || !master._alive) return true;
    elapsed += dt; spawnAcc += dt;
    timeLeft = Math.max(0, DURATION - elapsed);
    if (chain > 0 && hopT === 0 && elapsed - lastChainT > 2.4) { chain = 0; renderHud(); }
    /* Tempo & Spawnrate steigen sanft */
    const speed = 2.4 + elapsed / 25;
    const interval = Math.max(.7, 1.5 - elapsed / 70);
    if (spawnAcc > interval) { spawnAcc = 0; spawnMushroom(speed); }
    /* Pilze treiben quer; Zone-Ring pulsiert */
    for (let i = mushrooms.length - 1; i >= 0; i--) {
      const m = mushrooms[i];
      m.off += m.dir * m.speed * dt;
      m.bob += dt * 4;
      const p = base.clone().addScaledVector(lat, m.off)
        .add(up.clone().multiplyScalar(Math.abs(Math.sin(m.bob)) * .12));
      m.spr.position.copy(p);
      if (m.off > SPAN || m.off < -SPAN) removeMushroom(m);
    }
    const zp = 1 + Math.sin(elapsed * 4) * .12;
    zoneRing.scale.setScalar(2.6 * zp);
    /* Hüpfer-Animation (Sprung bei Treffer) */
    hopT = Math.max(0, hopT - dt * 3);
    const hop = Math.sin((1 - hopT) * Math.PI) * (hopT > 0 ? 1 : 0);
    hopper.position.copy(base).add(up.clone().multiplyScalar(1.5 + hop * 1.4));
    hopper.scale.setScalar(2 * (1 + hop * .25));
    if (zoneDisc) zoneDisc.material.opacity = .55 + Math.sin(elapsed * 4) * .25;
    if (timeLeft <= 0) { finish(false); return true; }
    renderTimer();
    return false;
  } };
  addAnim(master);
}

function spawnMushroom(speed) {
  const dir = Math.random() < .5 ? 1 : -1;
  const spr = emojiSprite('🍄', 1.3);
  scene.add(spr);
  mushrooms.push({ spr, off: -dir * SPAN, dir, speed: speed * (.9 + Math.random() * .25), bob: Math.random() * 6 });
}
function removeMushroom(m) {
  scene.remove(m.spr);
  mushrooms = mushrooms.filter(x => x !== m);
}

/* Ein Tipp = Sprung: der Pilz, der der Zone-Mitte am nächsten ist, zählt */
export function tapHop() {
  if (G.mode !== 'hopper') return;
  let best = null, bestAbs = 1e9;
  mushrooms.forEach(m => { const a = Math.abs(m.off); if (a < bestAbs) { bestAbs = a; best = m; } });
  if (!best || bestAbs > WIN_OK) {
    /* daneben – kein Punktverlust, Kette beginnt neu */
    sndTap(); chain = 0; renderHud();
    return;
  }
  /* Treffer-Güte nach Nähe zur Mitte */
  chain = Math.min(5, chain + 1); lastChainT = elapsed;
  let val, label;
  if (bestAbs < WIN_PERFEKT) { val = 3; label = 'PERFEKT!'; sndBlock(); }
  else if (bestAbs < WIN_GUT) { val = 2; label = 'Gut!'; sndCard(); }
  else { val = 1; label = 'Treffer'; sndCard(); }
  score += val * chain; hits++;
  hopT = 1; /* Hüpfer springt */
  if (chain >= 2) announce(label + '  ×' + chain, 600);
  /* getroffener Pilz wird gestempelt: Funken + verschwinden */
  stampSpark(best.spr.position.clone());
  removeMushroom(best);
  renderHud();
}
function stampSpark(p) {
  for (let i = 0; i < 6; i++) {
    const s = glowSprite(0xffe9a3, .3 + Math.random() * .3);
    s.position.copy(p);
    scene.add(s);
    const v = new THREE.Vector3((Math.random() - .5) * 3, 1.5 + Math.random() * 2, (Math.random() - .5) * 3);
    let t = 0;
    addAnim({ update(dt) {
      t += dt * 2; s.position.addScaledVector(v, dt);
      s.material.opacity = Math.max(0, 1 - t); s.scale.setScalar(Math.max(.05, .4 * (1 - t)));
      if (t >= 1) { scene.remove(s); return true; } return false;
    } });
  }
}

function renderHud() {
  document.getElementById('hopScore').textContent = '🍄 ' + score;
  const c = document.getElementById('hopChain');
  c.textContent = chain >= 2 ? '×' + chain : '';
  c.classList.toggle('hot', chain >= 3);
  if (chain > bestChain) bestChain = chain;
}
function renderTimer() {
  document.getElementById('hopTime').textContent = Math.ceil(timeLeft) + 's';
}

function finish(early) {
  document.getElementById('hopBar').classList.remove('on');
  if (master) master._alive = false;
  master = null;
  mushrooms.forEach(m => scene.remove(m.spr)); mushrooms = [];
  if (zoneRing) { scene.remove(zoneRing); zoneRing = null; }
  if (zoneDisc) { scene.remove(zoneDisc); zoneDisc = null; }
  if (hopper) { scene.remove(hopper); hopper = null; }
  rigPos.copy(savedRigPos); rigFocus.copy(savedRigFocus);
  G.mode = 'camp'; G.state = 'camp'; G.busy = false;
  document.getElementById('campBar')?.classList.add('on');
  if (early) { stopSpeech(); if (onDoneCb) onDoneCb(); return; }
  const gems = Math.max(3, Math.min(30, Math.round(score / 4)));
  sndWin();
  announce('🍄 ' + hits + ' Sprünge · beste Kette ×' + bestChain, 1500);
  sayStory('narrator', bestChain >= 4 ? 'Was für eine Hüpf-Kette!' : 'Toll gehüpft!');
  const p = camPos.clone().addScaledVector(fwd, 6).add(new THREE.Vector3(0, .5, 0));
  spawnGemReward(p, gems, () => { if (onDoneCb) onDoneCb(); });
}
