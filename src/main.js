/* =====================================================================
   WALDLÄUFER – Bootstrap & Hauptschleife
   1:1-Port der Referenz-Implementierung (waldlaeufer-final.html)
   auf Vite + ES-Module. Therapie-Invarianten siehe CLAUDE.md.
   ===================================================================== */
import './ui/style.css';
import { initRenderer, renderFrame, raycaster, pointer, camera } from './engine/renderer.js';
import { autoGovern } from './engine/quality.js';
import { initTextures } from './engine/textures.js';
import { updateAnims, clearAnims } from './engine/anims.js';
import { initCameraInput, updateCamera, rigPos, rigFocus, camPos, camFocus } from './engine/camera.js';
import { updateShards } from './engine/effects.js';
import { buildGround } from './world/terrain.js';
import { buildSky, updateSky } from './world/sky.js';
import { updateAtmosphere } from './world/atmosphere.js';
import { buildGrass, updateGrass } from './world/grass.js';
import { buildPollen, updatePollen, loadNature } from './world/vegetation.js';
import { planFloor, advance, clearWorldGroups, resetPath, updateWater } from './world/stations.js';
import { biomeFor } from './world/biomes.js';
import { loadModels } from './creatures/models.js';
import { updateMob, showKingSilhouette, removeKingSilhouette } from './creatures/mob.js';
import { updateCompanion } from './creatures/companion.js';
import { cards, updateCards } from './challenges/cards.js';
import { tapCard, speakSpell } from './challenges/spell.js';
import { tapBefehl, befehlTargets } from './challenges/befehl.js';
import { campTargets, tapCamp } from './world/camp.js';
import { fishTargets, tapFish } from './challenges/fishing.js';
import { fireflyTargets, tapFirefly } from './challenges/fireflies.js';
import { tapHop } from './challenges/hopper.js';
import { treasureTargets, tapLandmark } from './challenges/treasure.js';
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
let gameStarted = false;

/* Debug-Zugriff für Test-Sessions (nur im Dev-Server) */
if (import.meta.env.DEV) {
  window.__dbg = {
    G, cards: () => cards, camera: () => camera,
    /* Biome-Sichtung: direkt in ein Gebiet springen */
    jumpFloor(n) {
      G.floor = n;
      document.getElementById('floorTag').textContent = 'GEBIET ' + n + ' · ' + biomeFor(n).name;
      clearAnims(); /* laufende Reise-Anims würden sonst die Kamera kapern */
      clearWorldGroups(); /* Alt-Biom-Dekor restlos entfernen */
      planFloor();
      /* Kamera an den Gebietsanfang teleportieren (kurze Anreise) */
      const from = G.stations[0].from;
      rigPos.set(from.x, 3.7, from.z); camPos.copy(rigPos);
      setTimeout(advance, 400);
    },
    /* direkt zu Station i des aktuellen Gebiets (0-basiert) */
    jumpStation(i) {
      clearAnims();
      G.stIdx = i - 1;
      const from = G.stations[Math.max(0, i - 1)].pos;
      rigPos.set(from.x, 3.7, from.z); camPos.copy(rigPos);
      advance();
    },
    /* Tiermodell-Sichtung: __dbg.reveal('horse'|'wolf'|'fox'|'stag') */
    async reveal(key) {
      const { revealFreedAnimal } = await import('./creatures/mob.js');
      const { ANIMALS, BOSSES } = await import('./creatures/data.js');
      const { loadModelOnce } = await import('./creatures/models.js');
      let a = ANIMALS.find(x => x.key === key);
      if (!a) {
        const b = BOSSES.find(x => x.model && x.model.key === 'g_' + key);
        if (!b) return 'unbekannt: ' + key;
        await loadModelOnce(b.model.key, b.model.url, { toon: true });
        a = { key: b.model.key, scale: b.model.scale, grounded: true, y: 0 };
      } else await loadModelOnce(a.key, a.url, { toon: a.toon });
      revealFreedAnimal(a, rigFocus.clone());
      return 'ok';
    },
    /* ---------- SANDBOX: ruhige Lichtung zum Testen von Lager &
       Minispielen, OHNE dass die Encounter-Statemaschine dazwischenfunkt.
       (Guards in advance/startWordChallenge/mobTurn/startChest/startBefehl
       greifen auf G.sandbox.) ---------- */
    async _sandbox(pos = [0, 3.7, 12], focus = [0, 2.2, -2]) {
      const [{ clearAnims }, mob, cards, tts] = await Promise.all([
        import('./engine/anims.js'), import('./creatures/mob.js'),
        import('./challenges/cards.js'), import('./audio/tts.js')
      ]);
      G.sandbox = true;
      tts.stopSpeech(); clearAnims();
      if (mob.M.group) mob.despawnMobVisual();
      cards.clearCards();
      G.mob = null; G.word = null; G.mode = null; G.busy = false; G.state = 'idle';
      G.stations = []; G.stIdx = 0;
      ['mobBar', 'parry', 'fishBar', 'archBar', 'ffBar', 'hopBar', 'treaBar', 'campBar'].forEach(id =>
        document.getElementById(id)?.classList.remove('on'));
      document.getElementById('spellWord').innerHTML = '';
      document.getElementById('archReticle').style.display = 'none';
      rigPos.set(pos[0], pos[1], pos[2]); rigFocus.set(focus[0], focus[1], focus[2]);
      camPos.copy(rigPos); camFocus.copy(rigFocus);
      return 'sandbox bereit';
    },
    /* Normalbetrieb wiederherstellen (Sandbox verlassen) */
    unsandbox() { G.sandbox = false; return 'sandbox aus'; },
    /* Minispiele isoliert starten (Modul wird unter __dbg.mod abgelegt,
       damit Tests dieselbe Instanz wie der Start ansprechen) */
    async fish() { await this._sandbox(); const m = await import('./challenges/fishing.js'); this.mod = m; m.startFishing(); return 'fish'; },
    async arch() { await this._sandbox(); const m = await import('./challenges/archery.js'); this.mod = m; m.startArchery(); return 'arch'; },
    async fireflies() { await this._sandbox(); const m = await import('./challenges/fireflies.js'); this.mod = m; m.startFireflies(); return 'fireflies'; },
    async hopper() { await this._sandbox(); const m = await import('./challenges/hopper.js'); this.mod = m; m.startHopper(); return 'hopper'; },
    async treasure() { await this._sandbox(); const m = await import('./challenges/treasure.js'); this.mod = m; m.startTreasure(); return 'treasure'; },
    /* Lager-Sichtung mit allen Wächtern (ruhige Sandbox-Lichtung) */
    async camp() {
      await this._sandbox([0, 3.7, 12], [0, 1.4, 0]);
      const dummy = rigPos.clone(); dummy.set(0, 0, 0);
      G.stations = [{ pos: dummy }]; /* Dummy-Boss-Lichtung als Lager-Zentrum */
      G.trophies = ['🐺', '🐻', '🦊', '🦅', '🦌', '👑'];
      G.freedSpecies = { parrot: 1, flamingo: 1, stork: 1, horse: 1 };
      const { enterCamp } = await import('./world/camp.js');
      enterCamp();
      return 'ok';
    }
  };
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

  /* Startbildschirm: die Welt treibt sanft hinter der Startkarte */
  if (!gameStarted) {
    rigPos.set(Math.sin(time * .07) * 2.5, 3.6 + Math.sin(time * .11) * .15, 13 + Math.sin(time * .045) * 1.5);
    rigFocus.set(0, 2.2, 0);
  }

  updateGrass(time);
  updateWater(time);
  updateMob(time, dt);
  if (gameStarted) updateCompanion(dt, time);
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
  if (G.mode === 'archery') return; /* Bogenschießen hat eigene Pointer-Logik */
  if (G.busy) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (G.mode === 'fish') {
    const hits = raycaster.intersectObjects(fishTargets, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.syl) o = o.parent;
      if (o) tapFish(o);
    }
    return;
  }
  if (G.mode === 'fireflies') {
    const hits = raycaster.intersectObjects(fireflyTargets, false);
    if (hits.length) tapFirefly(hits[0].object);
    return;
  }
  if (G.mode === 'hopper') { tapHop(); return; } /* ein Tipp = Sprung */
  if (G.mode === 'treasure') {
    const hits = raycaster.intersectObjects(treasureTargets, false);
    if (hits.length) tapLandmark(hits[0].object);
    return;
  }
  if (G.mode === 'camp') {
    const hits = raycaster.intersectObjects(campTargets, true);
    if (hits.length) tapCamp(hits[0].object);
    return;
  }
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
let threeReady = false;
function initThree() {
  if (threeReady) return;
  threeReady = true;
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
/* Lebendiger Startbildschirm: Welt sofort aufbauen, Kamera treibt.
   Natur-Assets zuerst laden, damit schon die Kulisse echt aussieht. */
initThree();
loadNature().then(() => planFloor());
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
  gameStarted = true;
  playLevelMusic(G.floor);
  startAmbience();
  document.getElementById('startOv').classList.remove('on');
  document.getElementById('hud').classList.add('on');
  initThree();
  /* Schnell-Test: ?gebiet=3 springt direkt in ein Biom */
  const wanted = +(new URLSearchParams(location.search).get('gebiet') || 0);
  if (wanted > 0) G.floor = wanted;
  renderHearts(); renderHUD();
  document.getElementById('floorTag').textContent = 'GEBIET ' + G.floor + ' · ' + biomeFor(G.floor).name;
  rigPos.set(0, 3.7, 14); rigFocus.set(0, 2.2, 0);
  camPos.copy(rigPos); camFocus.copy(rigFocus);
  resetPath(); /* Titel-Kulisse hat den Pfad verschoben */
  planFloor();
  const begin = () => {
    announce('GEBIET ' + G.floor, 1200);
    if (innerHeight > innerWidth) setTimeout(() => {
      announce('🔄 Quer halten!', 1600);
      sayStory('narrator', UI_LINES.rotate);
    }, 1600);
    setTimeout(advance, 2000);
  };
  /* Rahmenhandlung beim allerersten Start dieses Profils (vorgelesen):
     der Schwarze König steht als Schatten auf dem Pfad – die 3D-Welt
     ist die Bühne, kein Vollbild-Textkarten-Overlay mehr */
  if (!G.seenIntro) {
    showKingSilhouette();
    playScene(INTRO, () => {
      removeKingSilhouette();
      G.seenIntro = true; saveActive(); begin();
    });
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
