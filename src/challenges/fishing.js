/* =====================================================================
   SILBEN-ANGELN – optionales Minigame (Roadmap 5)
   Belohnungsrunde im Lager: die Silben des Zielworts treiben wie Fische
   über einen Teich. Tippe sie in LESEREIHENFOLGE an. Neues Gefühl,
   aber Lese-Kern (Silben erkennen + Reihenfolge = Synthese).

   Therapie-Invarianten:
   • Audio-First: Erzähler nennt das Wort; das eingeblendete Wort ist
     freiwillige Lesehilfe, nie Pflicht. 📯 wiederholt jederzeit.
   • Falsche Tipps kosten NICHTS (kein Herz, kein Punkt) – sanftes
     Feedback, die Silbe schwimmt weiter.
   • Wörter NUR aus dem aktuellen Lernstand (poolFor) – nie schwerer.
   • Es wird KEIN Leitner-Trial gewertet (reine Belohnung, kein Test).
   ===================================================================== */
import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { rigPos, rigFocus, camPos } from '../engine/camera.js';
import { addAnim, easeOut } from '../engine/anims.js';
import { G } from '../state.js';
import { makeFloatingCard } from './cards.js';
import { spawnGemReward } from './reward.js';
import { toonMat } from '../engine/materials.js';
import { activeTier, poolFor, allWords } from '../learning/engine.js';
import { sayStory, sayGame, sayStorySeq, stopSpeech } from '../audio/tts.js';
import { sndCard, sndTap, sndWin, tone } from '../audio/sfx.js';
import { announce } from '../ui/feedback.js';

/* Rutenspitze (Bildschirm) aus dem #fishRod-SVG (robust gegen Layout) */
function rodTipScreen() {
  const r = document.getElementById('fishRod').getBoundingClientRect();
  return [r.left + r.width * (100 / 120), r.top + r.height * (18 / 160)];
}
/* Weltpunkt nahe der Rutenspitze (für den Einhol-Flug der Silbe) */
function rodWorld() {
  const [sx, sy] = rodTipScreen();
  const v = new THREE.Vector3((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, .5);
  v.unproject(camera);
  return camPos.clone().addScaledVector(v.sub(camPos).normalize(), 3.2);
}

export let fishTargets = [];
let pond = null, fishCards = [], master = null;
let words = [], wIdx = 0, expectIdx = 0, target = null, busyTransition = false;
let base = new THREE.Vector3(), fwd = new THREE.Vector3(), lat = new THREE.Vector3();
let savedRigPos = new THREE.Vector3(), savedRigFocus = new THREE.Vector3();
let onDoneCb = null;

const SPAN = 8.5;        /* halbe Teichbreite, über die die Silben treiben */
const CARD_Y = 1.4;      /* Lesehöhe über dem Wasser */
const CARD_SC = .62;     /* kleiner = einzelne „Fische" statt riesiger Billboards */
const WATER_Y = 0.12;
const DIST = 9.5;        /* Teich-/Karten-Abstand zur Kamera */

/* 2–4 Wörter aus dem aktuellen Lernstand (bevorzugt 2–3-silbig, bekannt) */
function pickWords(n) {
  const pool = [];
  for (let t = 1; t <= activeTier; t++) poolFor(t).forEach(w => pool.push(w));
  const good = pool.filter(w => w.s.length >= 2 && w.s.length <= 4);
  const src = good.length >= n ? good : (pool.length ? pool : poolFor(1));
  const sh = [...src].sort(() => Math.random() - .5);
  const out = [], seen = new Set();
  for (const w of sh) { if (seen.has(w.w)) continue; seen.add(w.w); out.push(w); if (out.length >= n) break; }
  return out;
}
function distractors(targetSyls, count) {
  const set = new Set(targetSyls);
  const all = [];
  allWords().forEach(w => w.s.forEach(s => { if (!set.has(s)) all.push(s); }));
  const uniq = [...new Set(all)].sort(() => Math.random() - .5);
  return uniq.slice(0, count);
}

export function startFishing(onDone) {
  if (master) return; /* läuft bereits – kein Doppelstart (Karten-Waisen) */
  onDoneCb = onDone || null;
  savedRigPos.copy(rigPos); savedRigFocus.copy(rigFocus);
  /* Blickrichtung aus der aktuellen Kamera ableiten → Teich vor den Spieler */
  fwd.copy(rigFocus).sub(rigPos).setY(0);
  if (fwd.lengthSq() < .01) fwd.set(0, 0, -1);
  fwd.normalize();
  lat.set(-fwd.z, 0, fwd.x);
  base.copy(rigPos).addScaledVector(fwd, DIST); base.y = WATER_Y;

  /* Teich (ruhiges Toon-Wasser, billig – die treibenden Silben sind die Bewegung) */
  pond = new THREE.Mesh(new THREE.CircleGeometry(13, 40),
    toonMat({ color: 0x37708e, transparent: true, opacity: .9 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(base.x, WATER_Y, base.z);
  scene.add(pond);

  /* Kamera sanft auf den Teich richten, leicht von oben */
  rigPos.y = Math.max(rigPos.y, 4.0);
  rigFocus.set(base.x, WATER_Y + .7, base.z);

  words = pickWords(3); wIdx = -1;
  G.state = 'fish'; G.mode = 'fish'; G.busy = false;
  document.getElementById('campBar')?.classList.remove('on');
  const bar = document.getElementById('fishBar'); bar.classList.add('on');
  document.getElementById('fishRod').classList.add('on');
  document.getElementById('fishLineSvg').classList.add('on');
  document.getElementById('fishHorn').onclick = () => { if (target) sayGame(target.w); };
  document.getElementById('fishQuit').onclick = () => finish(true);

  sayStorySeq([{ voice: 'narrator', text: 'Silben-Angeln! Tipp die Silben in der richtigen Reihenfolge an.' }]);

  /* ein Master-Update treibt alle Silben + Billboard, bis das Spiel endet */
  let alive = true, safety = 0;
  master = { update(dt) {
    if (!alive) return true;
    safety += dt;
    fishCards.forEach(c => {
      c.offset += c.dir * c.speed * dt;
      if (c.offset > SPAN) { c.offset = -SPAN; c.depth = (Math.random() - .5) * 3; }
      else if (c.offset < -SPAN) { c.offset = SPAN; c.depth = (Math.random() - .5) * 3; }
      c.bob += dt * 1.6;
      const p = base.clone().addScaledVector(lat, c.offset).addScaledVector(fwd, c.depth);
      p.y = CARD_Y + Math.sin(c.bob) * .12 + (c.lift || 0);
      c.mesh.position.copy(p);
      c.mesh.lookAt(camPos.x, p.y, camPos.z);
    });
    if (safety > 140) { alive = false; return true; } /* Sicherheitsnetz */
    return false;
  } };
  master._stop = () => { alive = false; };
  addAnim(master);
  setTimeout(nextRound, 1400);
}

function clearFish() {
  fishCards.forEach(c => scene.remove(c.mesh));
  fishCards = []; fishTargets = [];
}
function spawnCard(syl, isTarget) {
  const mesh = makeFloatingCard(syl);
  mesh.scale.setScalar(CARD_SC);
  scene.add(mesh);
  const c = {
    mesh, syl, isTarget, caught: false,
    offset: (Math.random() * 2 - 1) * SPAN,
    depth: (Math.random() - .5) * 3,
    speed: 1.2 + Math.random() * 1.1,
    dir: Math.random() < .5 ? 1 : -1,
    bob: Math.random() * 6.28, lift: 0
  };
  fishCards.push(c); fishTargets.push(mesh);
  return c;
}
function nextRound() {
  wIdx++;
  if (wIdx >= words.length) { finish(false); return; }
  clearFish();
  expectIdx = 0; busyTransition = false;
  target = words[wIdx];
  /* Zielsilben + 2 Ablenker, gut durchmischt über den Teich verteilt */
  target.s.forEach(s => spawnCard(s, true));
  distractors(target.s, 2).forEach(s => spawnCard(s, false));
  /* Startpositionen spreizen, damit nichts gestapelt startet */
  fishCards.forEach((c, i) => { c.offset = -SPAN + (i + .5) * (2 * SPAN / fishCards.length); });
  renderFishWord();
  announce('🎣 ' + target.w, 1100);
  sayStorySeq([
    { voice: 'narrator', text: 'Angle das Wort:' },
    { voice: 'word', text: target.w }
  ]);
}
function renderFishWord() {
  const el = document.getElementById('fishWord');
  el.innerHTML = target.s.map((s, i) =>
    `<span class="${i < expectIdx ? 'caught' : (i === expectIdx ? 'next' : '')}">${s}</span>`
  ).join('<i>·</i>');
}

export function tapFish(mesh) {
  if (G.mode !== 'fish' || busyTransition) return;
  const c = fishCards.find(x => x.mesh === mesh);
  if (!c || c.caught) return;
  const expected = target.s[expectIdx];
  if (c.syl === expected) {
    c.caught = true;
    sndCard();
    tone(330, .16, 'square', .05, 0, 320); /* Reel-Zip beim Anbeißen */
    sayGame(c.syl); /* Silbe vorsprechen (Laut-Schrift-Kopplung) */
    expectIdx++;
    renderFishWord();
    /* gefangene Silbe wird an der LEINE zur Angel eingeholt */
    fishTargets = fishTargets.filter(m => m !== c.mesh);
    fishCards = fishCards.filter(x => x !== c);
    const m = c.mesh;
    const lineEl = document.getElementById('fishLine');
    lineEl.style.display = '';
    const from = m.position.clone(), to = rodWorld();
    let t = 0;
    addAnim({ update(dt) {
      t += dt * 1.8;
      const k = easeOut(Math.min(1, t));
      m.position.lerpVectors(from, to, k);
      m.scale.setScalar(Math.max(.001, CARD_SC * (1 - k * .9)));
      m.lookAt(camPos.x, m.position.y, camPos.z);
      /* 2D-Leine: Rutenspitze → eingeholte Silbe */
      const pr = m.position.clone().project(camera);
      const [rx, ry] = rodTipScreen();
      lineEl.setAttribute('x1', rx.toFixed(0)); lineEl.setAttribute('y1', ry.toFixed(0));
      lineEl.setAttribute('x2', ((pr.x * .5 + .5) * innerWidth).toFixed(0));
      lineEl.setAttribute('y2', ((-pr.y * .5 + .5) * innerHeight).toFixed(0));
      if (t >= 1) { scene.remove(m); lineEl.style.display = 'none'; return true; }
      return false;
    } });
    if (expectIdx >= target.s.length) completeWord();
  } else {
    /* falsch: kein Punktverlust, sanftes Wackeln + neutraler Klick */
    sndTap();
    let t = 0; const m = c.mesh, bx = c.offset;
    addAnim({ update(dt) {
      t += dt * 12;
      c.lift = Math.sin(t) * .12 * Math.max(0, 1 - t / 6);
      if (t >= 6) { c.lift = 0; return true; }
      return false;
    } });
  }
}

function completeWord() {
  busyTransition = true;
  const word = target.w;
  const p = base.clone().add(new THREE.Vector3(0, 1.2, 0));
  announce('VOLLTREFFER! ' + word, 1100);
  sayStorySeq([{ voice: 'narrator', text: 'Volltreffer!' }, { voice: 'word', text: word }]);
  spawnGemReward(p, 3, () => setTimeout(nextRound, 700));
}

function finish(early) {
  const bar = document.getElementById('fishBar'); bar.classList.remove('on');
  document.getElementById('fishRod').classList.remove('on');
  document.getElementById('fishLineSvg').classList.remove('on');
  document.getElementById('fishLine').style.display = 'none';
  if (master && master._stop) master._stop();
  master = null;
  clearFish();
  if (pond) { scene.remove(pond); pond = null; }
  /* Kamera zurück ins Lager */
  rigPos.copy(savedRigPos); rigFocus.copy(savedRigFocus);
  G.mode = 'camp'; G.state = 'camp'; G.busy = false;
  document.getElementById('campBar')?.classList.add('on');
  if (!early) { sndWin(); sayStory('narrator', 'Toll geangelt! Deine Silben sitzen.'); }
  else stopSpeech();
  if (onDoneCb) onDoneCb();
}
