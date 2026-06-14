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
/* Bedienung: RUNTERSTREICHEN spannt (Pfeil zieht nach hinten), LINKS/RECHTS
   zielt; vertikal wird auf Zielscheiben-Höhe gezielt. */
let drawing = false, power = 0, aimX = 0, startY = 0, aimTargetY = 0;

const SPAN = 6.5;        /* seitliche Spreizung der Scheiben */
const DIST = 10.5;       /* näher → Scheiben & Wörter größer/lesbarer */
const DISC_R = 1.95;     /* Scheibenradius */
const MIN_POWER = .45;   /* darunter fällt der Pfeil zu kurz */
const DRAW_PX = 210;     /* so viel Runterstreichen = volle Kraft */

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
  bowRig = buildBow(); scene.add(bowRig); followBow();
  document.getElementById('archHorn').onclick = () => { if (target) sayGame(target.w); };
  document.getElementById('archQuit').onclick = () => finish(true);

  canvas = document.querySelector('canvas');
  canvas.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);

  sayStorySeq([{ voice: 'narrator', text: 'Bogenschießen! Streich nach unten zum Spannen, ziel nach links und rechts und lass los.' }]);

  master = { _alive: true, update(dt) {
    if (!master || !master._alive) return true;
    /* Ziel-Höhe = Bildschirm-Y der Scheibenreihe (links/rechts wird gezielt) */
    const bp = base.clone().project(camera);
    aimTargetY = (-bp.y * .5 + .5) * innerHeight;
    if (drawing) updateReticle();
    followBow(); /* vertikaler POV-Bogen, dreht mit dem Zielen, spannt mit der Kraft */
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

/* ---------- Eingabe: RUNTERSTREICHEN spannt, LINKS/RECHTS zielt ---------- */
function updateReticle() {
  const r = document.getElementById('archReticle');
  r.style.left = aimX + 'px'; r.style.top = aimTargetY + 'px'; /* vertikal auf Ziel-Höhe */
}
/* ---------- Vertikaler POV-Bogen (3D, wie gehalten) ----------
   Der Spieler sieht den Bogen aufrecht vor sich. RUNTERSTREICHEN zieht den
   Pfeil + die Sehne nach hinten (zur Kamera). LINKS/RECHTS dreht den Bogen
   zum Zielen. Loslassen → der 3D-Pfeil fliegt zum Ziel. */
let bowRig = null, bowString = null, bowArrow = null;
function buildBow() {
  const rig = new THREE.Group();
  const brown = toonMat({ color: 0x6e4b2a });
  const light = toonMat({ color: 0xd4d9df });
  /* Limb: AUFRECHTER Bogen (Spitzen oben/unten), wölbt nach LINKS
     (wie in der linken Hand gehalten – rechts bleibt frei zum Zielen) */
  const limb = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.028, 8, 40, Math.PI), brown);
  limb.rotation.z = Math.PI / 2;
  rig.add(limb);
  /* kleiner Griff in der Mitte */
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 8), toonMat({ color: 0x4a3320 }));
  rig.add(grip);
  /* Sehne: oben → Nock → unten; Nock wird beim Spannen nach +Z (zur Kamera) gezogen */
  const sg = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.5, 0)]);
  bowString = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xf3f3ee }));
  rig.add(bowString);
  /* Pfeil: Schaft entlang -Z (zeigt ins Bild → fliegt zum Ziel) + Spitze + Federn */
  const arr = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.15, 6), light);
  shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.57; arr.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), light);
  tip.rotation.x = -Math.PI / 2; tip.position.z = -1.18; arr.add(tip);
  [0, 1].forEach(i => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(i ? 0.002 : 0.12, i ? 0.12 : 0.002, 0.14), toonMat({ color: 0xe0533a }));
    f.position.set(0, 0, 0.02); arr.add(f);
  });
  arr.visible = false; bowArrow = arr; rig.add(arr);
  rig.scale.setScalar(0.72);
  return rig;
}
function updateBow(pw) {
  if (!bowString) return;
  const nockZ = pw * 0.6; /* je mehr Kraft, desto weiter der Nock zur Kamera = nach hinten */
  const pos = bowString.geometry.attributes.position;
  pos.setXYZ(1, 0, 0, nockZ); pos.needsUpdate = true;
  if (bowArrow) bowArrow.position.z = nockZ;
}
/* Jeden Frame: aufrecht vor der Kamera, dreht links/rechts mit dem Zielen */
export function followBow() {
  if (!bowRig) return;
  const aimN = aimX / Math.max(1, innerWidth) - 0.5;          /* -0.5 (links) … +0.5 (rechts) */
  bowRig.position.copy(camera.position);
  bowRig.quaternion.copy(camera.quaternion);
  /* aufrecht, etwas links gehalten; GLEITET seitlich mit dem Zielen + leichter Schwenk */
  bowRig.translateX(-0.16 + aimN * 0.8); bowRig.translateY(-0.42); bowRig.translateZ(-1.5);
  bowRig.rotateY(-aimN * 0.32);
  updateBow(drawing ? power : 0);
}
function onDown(e) {
  if (G.mode !== 'archery' || busyShot) return;
  drawing = true; power = 0; startY = e.clientY; aimX = e.clientX;
  updateReticle();
  document.getElementById('archReticle').style.display = 'block';
  document.getElementById('archPower').classList.add('on');
  if (bowArrow) bowArrow.visible = true; /* Pfeil einlegen */
  sndTap();
}
function onMove(e) {
  if (!drawing) return;
  aimX = e.clientX;
  power = Math.max(0, Math.min(1, (e.clientY - startY) / DRAW_PX)); /* runter = spannen */
  updateReticle(); updatePowerUI();
}
function updatePowerUI() {
  document.getElementById('archPowerFill').style.height = Math.round(power * 100) + '%';
  document.getElementById('archReticle').classList.toggle('charged', power >= MIN_POWER);
}
function onUp(e) {
  if (!drawing) return;
  drawing = false;
  if (e) { aimX = e.clientX; power = Math.max(0, Math.min(1, (e.clientY - startY) / DRAW_PX)); }
  document.getElementById('archPower').classList.remove('on');
  document.getElementById('archPowerFill').style.height = '0%';
  document.getElementById('archReticle').style.display = 'none';
  document.getElementById('archReticle').classList.remove('charged');
  if (bowArrow) bowArrow.visible = false; /* gehaltener Pfeil weg → 3D-Pfeil fliegt */
  shoot(power);
  power = 0;
}

function shoot(pw) {
  if (busyShot) { if (import.meta.env.DEV) _lastShot = { blocked: true, hits: 0, uv: null }; return; }
  busyShot = true;
  sndCast();
  /* Ziel-Punkt: Kamerastrahl durch (aimX, Ziel-Höhe) auf die Zielebene */
  const ndc = new THREE.Vector2((aimX / innerWidth) * 2 - 1, -(aimTargetY / innerHeight) * 2 + 1);
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
  document.getElementById('archReticle').style.display = 'none';
  if (bowRig) { scene.remove(bowRig); bowRig = null; bowString = null; bowArrow = null; }
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
