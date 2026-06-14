/* =====================================================================
   WORT-BOGENSCHIESSEN – optionales Minigame (Roadmap 5a)
   Belohnungsrunde im Lager. Echte Bogen-Mechanik:
   • HALTEN spannt den Bogen (Kraft lädt) – sichtbarer Kraftbalken.
   • ZIELEN: der Finger bewegt das Fadenkreuz über die Zielscheiben.
   • LOSLASSEN schießt den Pfeil.
   • EXTRA-Kristalle je nach Treffer-Nähe zum Bullseye (Ring-Wertung).

   Der Erzähler nennt das Zielwort (Audio-First); das Wort über jeder
   Scheibe ist freiwillige Lesehilfe. Fehlschuss/falsches Wort kostet
   NICHTS (Therapie-Invariante 4) – einfach nochmal spannen.
   Wörter nur aus dem aktuellen Lernstand, kein Leitner-Trial.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { camera } from '../engine/renderer.js';
import { rigPos, rigFocus, camPos } from '../engine/camera.js';
import { addAnim, easeOut } from '../engine/anims.js';
import { G } from '../state.js';
import { makeFloatingCard } from './cards.js';
import { spawnGemReward } from './reward.js';
import { toonMat } from '../engine/materials.js';
import { activeTier, poolFor, allWords } from '../learning/engine.js';
import { sayStory, sayGame, sayStorySeq, stopSpeech } from '../audio/tts.js';
import { sndCard, sndTap, sndWin, sndCast, sndBlock } from '../audio/sfx.js';
import { announce } from '../ui/feedback.js';

let targets = [], master = null, canvas = null;
/* Dev-Hooks für automatisierte Tests (kein Produktions-Pfad).
   _dbg.shoot(sx,sy,power) zielt auf einen Bildschirmpunkt und löst den
   vollen Schuss-Flow aus – ohne synthetische Pointer-Events (die im
   Headless-Browser unzuverlässig sind). */
let _lastShot = null;
export const _dbg = {
  targets: () => targets,
  target: () => target,
  shoot(sx, sy, pw = 1) { aimX = sx; aimY = sy; shoot(pw); return _lastShot; },
  last: () => _lastShot
};
let words = [], wIdx = 0, target = null, busyShot = false;
let base = new THREE.Vector3(), fwd = new THREE.Vector3(), lat = new THREE.Vector3();
let savedRigPos = new THREE.Vector3(), savedRigFocus = new THREE.Vector3();
let onDoneCb = null;
const ray = new THREE.Raycaster();
const aimPlane = new THREE.Plane();
let drawing = false, power = 0, aimX = 0, aimY = 0;

const SPAN = 6.5;        /* seitliche Spreizung der Scheiben */
const DIST = 10.5;       /* näher → Scheiben & Wörter größer/lesbarer */
const DISC_R = 1.95;     /* Scheibenradius */
const MIN_POWER = .45;   /* darunter fällt der Pfeil zu kurz */

/* ---------- Zielscheiben-Textur (konzentrische Ringe) ---------- */
let discTex = null;
function dartTexture() {
  if (discTex) return discTex;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), c = S / 2;
  const rings = [[1.0, '#f4f1e6'], [.78, '#3a2a1a'], [.62, '#e6f1f6'], [.45, '#c4453b'], [.2, '#ffd34a'], [.08, '#b83b32']];
  rings.forEach(([rr, col]) => {
    ctx.beginPath(); ctx.arc(c, c, c * rr, 0, 7); ctx.fillStyle = col; ctx.fill();
  });
  /* feiner Rand */
  ctx.beginPath(); ctx.arc(c, c, c * .985, 0, 7); ctx.lineWidth = 6; ctx.strokeStyle = '#6e4b2a'; ctx.stroke();
  discTex = new THREE.CanvasTexture(cv);
  return discTex;
}

function pickWords(n) {
  const pool = [];
  for (let t = 1; t <= activeTier; t++) poolFor(t).forEach(w => pool.push(w));
  const src = pool.length ? pool : poolFor(1);
  const sh = [...src].sort(() => Math.random() - .5);
  const out = [], seen = new Set();
  for (const w of sh) { if (seen.has(w.w)) continue; seen.add(w.w); out.push(w); if (out.length >= n) break; }
  return out;
}
function distractorWords(targetWord, count) {
  const all = allWords().filter(w => w.w !== targetWord);
  return [...all].sort(() => Math.random() - .5).slice(0, count);
}

export function startArchery(onDone) {
  if (master) return;
  onDoneCb = onDone || null;
  savedRigPos.copy(rigPos); savedRigFocus.copy(rigFocus);
  fwd.copy(rigFocus).sub(rigPos).setY(0);
  if (fwd.lengthSq() < .01) fwd.set(0, 0, -1);
  fwd.normalize();
  lat.set(-fwd.z, 0, fwd.x);
  base.copy(rigPos).addScaledVector(fwd, DIST); base.y = 2.6;
  /* Zielebene (für den Pfeil-Auftreffpunkt) steht senkrecht, zur Kamera gewandt */
  aimPlane.setFromNormalAndCoplanarPoint(fwd.clone().negate(), base);

  rigPos.y = Math.max(rigPos.y, 3.6);
  rigFocus.copy(base);

  words = pickWords(3); wIdx = -1;
  G.state = 'archery'; G.mode = 'archery'; G.busy = false;
  document.getElementById('campBar')?.classList.remove('on');
  document.getElementById('archBar').classList.add('on');
  document.getElementById('archHint').classList.add('on');
  document.getElementById('archBow').classList.add('on');
  document.getElementById('archHorn').onclick = () => { if (target) sayGame(target.w); };
  document.getElementById('archQuit').onclick = () => finish(true);

  canvas = document.querySelector('canvas');
  canvas.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);

  sayStorySeq([{ voice: 'narrator', text: 'Bogenschießen! Halt den Finger zum Spannen, ziel und lass los.' }]);

  master = { _alive: true, update(dt) {
    if (!master || !master._alive) return true;
    if (drawing) { power = Math.min(1, power + dt / .7); updatePowerUI(); }
    /* Scheiben schaukeln sanft seitlich (Zielen mit Timing = Geschick) */
    targets.forEach(t => {
      t.sway += dt * t.swaySpeed;
      const p = base.clone()
        .addScaledVector(lat, t.offset + Math.sin(t.sway) * 1.1)
        .addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(t.sway * .8) * .25);
      t.grp.position.copy(p);
      t.grp.lookAt(camPos.x, p.y, camPos.z);
    });
    return false;
  } };
  addAnim(master);
  setTimeout(nextRound, 1200);
}

function clearTargets() {
  targets.forEach(t => scene.remove(t.grp));
  targets = [];
}
function spawnTarget(word, isTarget, offset) {
  const grp = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(DISC_R, 48), toonMat({ map: dartTexture() }));
  disc.userData.isDisc = true;
  grp.add(disc);
  /* Wort als große, klar lesbare Karte über der Scheibe */
  const card = makeFloatingCard(word);
  card.scale.setScalar(1.05);
  card.position.set(0, DISC_R + 1.25, .05);
  grp.add(card);
  scene.add(grp);
  const t = { grp, disc, w: word, isTarget, offset,
    sway: Math.random() * 6.28, swaySpeed: .5 + Math.random() * .5 };
  targets.push(t);
  return t;
}
function nextRound() {
  wIdx++;
  if (wIdx >= words.length) { finish(false); return; }
  clearTargets();
  busyShot = false;
  target = words[wIdx];
  const all = [{ w: target.w, isT: true }, ...distractorWords(target.w, 2).map(d => ({ w: d.w, isT: false }))]
    .sort(() => Math.random() - .5);
  all.forEach((e, i) => spawnTarget(e.w, e.isT, -SPAN + i * SPAN));
  document.getElementById('archWord').textContent = target.w;
  announce('🏹 ' + target.w, 1100);
  sayStorySeq([{ voice: 'narrator', text: 'Triff das Wort:' }, { voice: 'word', text: target.w }]);
}

/* ---------- Eingabe: Spannen → Zielen → Loslassen ---------- */
function setAim(e) {
  aimX = e.clientX; aimY = e.clientY;
  const r = document.getElementById('archReticle');
  r.style.left = aimX + 'px'; r.style.top = aimY + 'px';
}
/* Sichtbarer Bogen: Sehne + Pfeil ziehen mit der Kraft nach hinten */
function drawBow(pw) {
  const nockX = 128 + pw * 44;
  const str = document.getElementById('archString');
  if (str) str.setAttribute('points', `128,14 ${nockX.toFixed(1)},80 128,146`);
  const arrow = document.getElementById('archArrow');
  const head = document.getElementById('archHead');
  if (arrow && head) {
    const tip = nockX - 95;
    arrow.setAttribute('x1', nockX.toFixed(1)); arrow.setAttribute('x2', tip.toFixed(1));
    head.setAttribute('points', `${tip.toFixed(1)},80 ${(tip + 14).toFixed(1)},73 ${(tip + 14).toFixed(1)},87`);
  }
}
function onDown(e) {
  if (G.mode !== 'archery' || busyShot) return;
  drawing = true; power = 0;
  setAim(e);
  document.getElementById('archReticle').style.display = 'block';
  document.getElementById('archPower').classList.add('on');
  document.getElementById('archArrowG').style.display = ''; /* Pfeil eingelegt */
  drawBow(0);
  sndTap();
}
function onMove(e) { if (drawing) setAim(e); }
function updatePowerUI() {
  document.getElementById('archPowerFill').style.height = Math.round(power * 100) + '%';
  document.getElementById('archReticle').classList.toggle('charged', power >= MIN_POWER);
  drawBow(power);
}
function onUp(e) {
  if (!drawing) return;
  drawing = false;
  setAim(e);
  document.getElementById('archPower').classList.remove('on');
  document.getElementById('archPowerFill').style.height = '0%';
  document.getElementById('archReticle').style.display = 'none';
  document.getElementById('archReticle').classList.remove('charged');
  /* Bogen schnellt zurück, Pfeil ist weg (fliegt in 3D) */
  document.getElementById('archArrowG').style.display = 'none';
  drawBow(0);
  shoot(power);
  power = 0;
}

function shoot(pw) {
  if (busyShot) { if (import.meta.env.DEV) _lastShot = { blocked: true, hits: 0, uv: null }; return; }
  busyShot = true;
  sndCast();
  /* Ziel-Punkt: Kamerastrahl durch das Fadenkreuz auf die Zielebene */
  const ndc = new THREE.Vector2((aimX / innerWidth) * 2 - 1, -(aimY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const aimPt = new THREE.Vector3();
  if (!ray.ray.intersectPlane(aimPlane, aimPt)) aimPt.copy(base);

  /* Treffer-Auswertung schon jetzt (raycast gegen Scheiben).
     Matrizen frisch ziehen: die Scheiben schaukeln pro Frame, der
     Raycast braucht ihre AKTUELLE Weltposition (nicht die vom letzten
     Render-Frame) – sonst geht der Treffer bei langsamen Frames daneben. */
  /* GRUPPEN-Matrix frisch ziehen (die Scheibe sitzt im Gruppen-Ursprung;
     die Gruppe schaukelt pro Frame) → der Raycast nutzt die AKTUELLE
     Weltposition, auch wenn seit dem letzten Render-Frame Zeit verging. */
  targets.forEach(t => t.grp.updateMatrixWorld(true));
  const hits = ray.intersectObjects(targets.map(t => t.disc), false);
  if (import.meta.env.DEV) _lastShot = { hits: hits.length,
    uv: hits[0] && hits[0].uv ? [+hits[0].uv.x.toFixed(2), +hits[0].uv.y.toFixed(2)] : null };
  let result = null; /* {t, r} */
  if (hits.length) {
    const h = hits[0];
    const t = targets.find(x => x.disc === h.object);
    let rr = 1;
    if (h.uv) { const dx = h.uv.x - .5, dy = h.uv.y - .5; rr = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2); }
    result = { t, r: rr };
  }

  /* Pfeil fliegt von unten (Bogen) zum Zielpunkt – Bogen flacher bei viel Kraft.
     Zu wenig Kraft → der Pfeil fällt kurz davor zu Boden (Fehlschuss). */
  const reach = pw >= MIN_POWER;
  const from = camPos.clone().addScaledVector(fwd, 1.2).add(new THREE.Vector3(0, -.8, 0));
  const landShort = base.clone().lerp(from, .45);
  const dest = reach ? aimPt.clone() : landShort;
  spawnArrow(from, dest, pw, () => resolveShot(reach ? result : null, pw));
}

function spawnArrow(from, to, pw, onLand) {
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.1, 6), toonMat({ color: 0x7a5a36 }));
  shaft.rotation.x = Math.PI / 2; arrow.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.08, .22, 8), toonMat({ color: 0xcfd4da }));
  tip.rotation.x = Math.PI / 2; tip.position.z = .62; arrow.add(tip);
  arrow.position.copy(from);
  scene.add(arrow);
  const dist = from.distanceTo(to);
  const dur = Math.max(.32, dist / 38);
  const arc = (1 - pw) * .9 + .15; /* viel Kraft = flach, wenig = hoher Bogen */
  let t = 0;
  addAnim({ update(dt) {
    t += dt / dur; const k = Math.min(1, t);
    const p = from.clone().lerp(to, k);
    p.y += Math.sin(k * Math.PI) * arc * dist * .12;
    /* Pfeil zeigt in Flugrichtung */
    const ahead = from.clone().lerp(to, Math.min(1, k + .03));
    ahead.y += Math.sin(Math.min(1, k + .03) * Math.PI) * arc * dist * .12;
    arrow.position.copy(p); arrow.lookAt(ahead);
    if (t >= 1) {
      /* kurz stecken lassen, dann entfernen */
      setTimeout(() => scene.remove(arrow), 600);
      onLand();
      return true;
    }
    return false;
  } });
}

function resolveShot(result, pw) {
  if (!result) {
    /* Fehlschuss/zu kurz/danebengezielt – KEIN Punktverlust */
    sndTap();
    sayStory('narrator', pw < MIN_POWER ? 'Spann den Bogen weiter!' : 'Daneben – probier es nochmal!');
    busyShot = false;
    return;
  }
  if (!result.t.isTarget) {
    sndTap();
    announce('Falsches Wort', 800);
    sayStorySeq([{ voice: 'narrator', text: 'Das war ein anderes Wort. Triff:' }, { voice: 'word', text: target.w }]);
    busyShot = false;
    return;
  }
  /* Treffer auf das richtige Wort: Ring-Wertung → Extra-Kristalle */
  const r = result.r;
  let gems, label;
  if (r < .18) { gems = 5; label = 'BULLSEYE! +5'; sndBlock(); }
  else if (r < .42) { gems = 3; label = 'Super Treffer! +3'; sndCard(); }
  else { gems = 1; label = 'Getroffen! +1'; sndCard(); }
  announce('🎯 ' + label, 1100);
  sayStorySeq([{ voice: 'word', text: target.w }, { voice: 'narrator', text: r < .18 ? 'Bullseye!' : 'Getroffen!' }]);
  const p = result.t.grp.position.clone().add(new THREE.Vector3(0, .2, 0));
  spawnGemReward(p, gems, () => setTimeout(nextRound, 700));
}

function finish(early) {
  document.getElementById('archBar').classList.remove('on');
  document.getElementById('archHint').classList.remove('on');
  document.getElementById('archPower').classList.remove('on');
  document.getElementById('archBow').classList.remove('on');
  document.getElementById('archArrowG').style.display = 'none';
  document.getElementById('archReticle').style.display = 'none';
  if (canvas) canvas.removeEventListener('pointerdown', onDown);
  removeEventListener('pointermove', onMove);
  removeEventListener('pointerup', onUp);
  if (master) master._alive = false;
  master = null; drawing = false;
  clearTargets();
  rigPos.copy(savedRigPos); rigFocus.copy(savedRigFocus);
  G.mode = 'camp'; G.state = 'camp'; G.busy = false;
  document.getElementById('campBar')?.classList.add('on');
  if (!early) { sndWin(); sayStory('narrator', 'Scharf geschossen! Toll gezielt.'); }
  else stopSpeech();
  if (onDoneCb) onDoneCb();
}
