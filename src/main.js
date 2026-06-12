/* =====================================================================
   WALDLÄUFER – Bootstrap & Hauptschleife
   1:1-Port der Referenz-Implementierung (waldlaeufer-final.html)
   auf Vite + ES-Module. Therapie-Invarianten siehe CLAUDE.md.
   ===================================================================== */
import './ui/style.css';
import { initRenderer, renderFrame, raycaster, pointer, camera } from './engine/renderer.js';
import { autoGovern } from './engine/quality.js';
import { initTextures } from './engine/textures.js';
import { updateAnims } from './engine/anims.js';
import { initCameraInput, updateCamera, rigPos, rigFocus, camPos, camFocus } from './engine/camera.js';
import { updateShards } from './engine/effects.js';
import { buildGround } from './world/terrain.js';
import { buildSky, updateSky } from './world/sky.js';
import { updateAtmosphere } from './world/atmosphere.js';
import { buildGrass, updateGrass } from './world/grass.js';
import { buildPollen, updatePollen } from './world/vegetation.js';
import { planFloor, advance } from './world/stations.js';
import { loadModels } from './creatures/models.js';
import { updateMob } from './creatures/mob.js';
import { cards, updateCards } from './challenges/cards.js';
import { tapCard, speakSpell } from './challenges/spell.js';
import { tapBefehl, befehlTargets } from './challenges/befehl.js';
import { revive } from './challenges/combat.js';
import { G } from './state.js';
import { renderHearts, renderHUD } from './ui/hud.js';
import { announce } from './ui/feedback.js';
import { wireOverlays } from './ui/overlays.js';
import { ac, sndBird, loadSfx } from './audio/sfx.js';
import { startAmbience } from './audio/ambience.js';
import { loadVoiceManifest } from './audio/tts.js';
import { playTitleMusic, playLevelMusic } from './audio/music.js';
import { listProfiles, createProfile, selectProfile, saveActive } from './meta/save.js';
import { initScenes, playScene } from './story/scenes.js';
import { INTRO, UI_LINES } from './story/content.js';
import { sayStory } from './audio/tts.js';

let birdT = 4;

/* Debug-Zugriff für Test-Sessions (nur im Dev-Server) */
if (import.meta.env.DEV) {
  window.__dbg = { G, cards: () => cards, camera: () => camera };
}

/* ---------- Loop ---------- */
let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  loop(t);
}
/* Dev-Server: Wenn rAF pausiert (Fenster verdeckt/Tab im Hintergrund),
   treibt ein Timer den Loop weiter – wichtig für automatisierte Tests.
   In Produktion pausiert das Spiel wie gewohnt (Akku!). */
if (import.meta.env.DEV) {
  setInterval(() => { if (performance.now() - lastT > 200) loop(performance.now()); }, 100);
}
function loop(t) {
  const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
  const time = t / 1000;
  autoGovern(dt);

  updateGrass(time);
  updateMob(time, dt);
  updateSky(dt);
  updateAtmosphere(dt, time);
  updateCards(dt);
  updatePollen(time, dt);
  updateShards(dt);
  /* Snapshot-Iteration: neu gestartete Animationen gehen nie verloren */
  updateAnims(dt);

  birdT -= dt;
  if (birdT < 0) { birdT = 6 + Math.random() * 9; sndBird(); }

  updateCamera(dt);
  renderFrame();
}

/* ---------- Tap-Routing ---------- */
function onTap(e) {
  ac();
  if (G.busy) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (G.mode === 'befehl') {
    const hits = raycaster.intersectObjects(befehlTargets, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.color) o = o.parent;
      if (o) tapBefehl(o);
    }
    return;
  }
  if (!G.word) return;
  const hits = raycaster.intersectObjects(cards.filter(r => !r.userData.dead));
  if (hits.length) tapCard(hits[0].object);
}

/* ---------- Start ---------- */
function initThree() {
  initRenderer();
  initTextures();
  buildSky();
  buildGround();
  buildGrass();
  buildPollen();
  loadModels();
  initCameraInput();
  document.querySelector('canvas').addEventListener('pointerdown', onTap);
  requestAnimationFrame(frame);
}

wireOverlays();
initScenes();
loadVoiceManifest();
loadSfx();
/* Titelsong + gesprochene Begrüßung ab der ersten Berührung des
   Startbildschirms (vorher blockiert der Browser Autoplay).
   Audio-First: niemand muss den Startbildschirm LESEN können. */
document.addEventListener('pointerdown', e => {
  if (!document.getElementById('startOv').classList.contains('on')) return;
  playTitleMusic();
  /* nicht über die Begrüßung quatschen, wenn der erste Tap schon startet */
  if (e.target.closest('.profileBtn') || e.target.closest('#startBtn')) return;
  sayStory('narrator', listProfiles().length ? UI_LINES.welcomeBack : UI_LINES.welcomeNew);
}, { once: true });
document.getElementById('hornBtn').addEventListener('click', speakSpell);
document.getElementById('reviveBtn').addEventListener('click', revive);
addEventListener('pagehide', saveActive);

function startGame() {
  ac();
  playLevelMusic(G.floor);
  startAmbience();
  document.getElementById('startOv').classList.remove('on');
  document.getElementById('hud').classList.add('on');
  initThree();
  renderHearts(); renderHUD();
  document.getElementById('floorTag').textContent = 'GEBIET ' + G.floor;
  rigPos.set(0, 3.7, 14); rigFocus.set(0, 2.2, 0);
  camPos.copy(rigPos); camFocus.copy(rigFocus);
  planFloor();
  const begin = () => {
    announce('GEBIET ' + G.floor, 1200);
    if (innerHeight > innerWidth) setTimeout(() => {
      announce('🔄 Quer halten!', 1600);
      sayStory('narrator', UI_LINES.rotate);
    }, 1600);
    setTimeout(advance, 2000);
  };
  /* Rahmenhandlung beim allerersten Start dieses Profils (vorgelesen) */
  if (!G.seenIntro) {
    playScene(INTRO, () => { G.seenIntro = true; saveActive(); begin(); });
  } else begin();
}

/* ---------- Profil-Auswahl (lokale Speicherstände, kein Account) ---------- */
let newPlayerMode = false;
function renderStartProfiles() {
  const list = document.getElementById('profileList');
  const row = document.getElementById('newPlayerRow');
  const btn = document.getElementById('startBtn');
  const profiles = listProfiles();
  list.innerHTML = '';
  profiles.forEach(p => {
    const b = document.createElement('button');
    b.className = 'profileBtn';
    const name = document.createElement('span');
    name.textContent = '▶ ' + p.name;
    const meta = document.createElement('small');
    meta.textContent = p.data ? `Gebiet ${p.data.floor} · 💎 ${p.data.gems}` : 'Neu';
    b.append(name, meta);
    b.addEventListener('pointerdown', () => { selectProfile(p.id); startGame(); });
    list.appendChild(b);
  });
  newPlayerMode = !profiles.length;
  row.style.display = newPlayerMode ? 'block' : 'none';
  btn.textContent = newPlayerMode ? "⚔  LOS GEHT'S" : '✨  NEUER WALDLÄUFER';
}
renderStartProfiles();

document.getElementById('startBtn').addEventListener('pointerdown', () => {
  const row = document.getElementById('newPlayerRow');
  const btn = document.getElementById('startBtn');
  if (!newPlayerMode) {
    /* erst Namensfeld einblenden, Start beim zweiten Tap */
    newPlayerMode = true;
    row.style.display = 'block';
    btn.textContent = "⚔  LOS GEHT'S";
    document.getElementById('newName').focus();
    return;
  }
  const name = (document.getElementById('newName').value.trim() || 'WALDLÄUFER')
    .toUpperCase().slice(0, 12);
  createProfile(name);
  startGame();
});
document.getElementById('newName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('startBtn').dispatchEvent(new Event('pointerdown'));
});
