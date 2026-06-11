/* ---------- Overlays: Pause, Einstellungen, Gebiet geschafft,
   Eltern-Panel mit Live-Lern-Report ---------- */
import { G } from '../state.js';
import { SESSION, activeTier, tierMastery, TIER_NAMES } from '../learning/engine.js';
import { BOSSES } from '../creatures/data.js';
import { planFloor, advance } from '../world/stations.js';
import { renderHearts } from './hud.js';
import { announce } from './feedback.js';
import { say, setVoiceOn } from '../audio/tts.js';
import { sndWin } from '../audio/sfx.js';
import { setQuality, setRES } from '../engine/quality.js';
import { saveActive } from '../meta/save.js';
import { FLOOR_QUOTES } from '../story/content.js';

export function ovOn(id) { document.getElementById(id).classList.add('on'); }
export function ovOff(id) { document.getElementById(id).classList.remove('on'); }

export function openPause() {
  document.getElementById('pauseStats').innerHTML = `
    <div class="stat"><div class="n">${G.gems}</div><div class="l">💎 KRISTALLE</div></div>
    <div class="stat"><div class="n">${G.kills}</div><div class="l">TIERE BEFREIT</div></div>
    <div class="stat"><div class="n">${G.trophies.length}</div><div class="l">FIGUREN</div></div>`;
  ovOn('pauseOv');
}
export function openAdult() {
  const quote = SESSION.words ? Math.round(SESSION.clean / SESSION.words * 100) : 0;
  document.getElementById('reportStats').innerHTML =
    `<p style="margin:4px 0 10px">Wörter geübt: <b style="color:#9fe86f">${SESSION.words}</b>
     &nbsp;·&nbsp; davon fehlerfrei: <b style="color:#9fe86f">${quote}%</b>
     &nbsp;·&nbsp; aktive Stufe: <b style="color:#9fe86f">${activeTier}</b></p>`;
  document.getElementById('reportBars').innerHTML = [1, 2, 3, 4].map(t => {
    const m = Math.round(tierMastery(t) * 100);
    return `<div class="mbarWrap"><span>${TIER_NAMES[t]}</span>
      <div class="mbar"><div style="width:${m}%"></div></div><b>${m}%</b></div>`;
  }).join('');
  ovOn('adultOv');
}
export function openSettings() { ovOn('setOv'); }

/* ---------- Gebiet geschafft ---------- */
export function showFloorClear() {
  sndWin();
  const quote = FLOOR_QUOTES[(G.floor - 1) % FLOOR_QUOTES.length];
  document.getElementById('floorSub').innerHTML =
    `Du hast den <b style="color:#e9d5ff">${BOSSES[Math.min(G.floor - 1, BOSSES.length - 1)].name}</b> bezwungen<br>und seine Figur erbeutet:` +
    (G.companion ? `<br><i style="color:#b8ffd9">${G.companion.icon} „${quote}"</i>` : '');
  document.getElementById('trophyRow').textContent = G.trophies.join(' ');
  document.getElementById('floorStats').innerHTML = `
    <div class="stat"><div class="n">${G.gems}</div><div class="l">💎 GESAMT</div></div>
    <div class="stat"><div class="n">${G.kills}</div><div class="l">BEFREIT</div></div>
    <div class="stat"><div class="n">${G.floor}</div><div class="l">GEBIET</div></div>`;
  ovOn('floorOv');
  say('Gebiet geschafft! Du hast die Figur erbeutet. ' + (G.companion ? quote : ''), 1, .95);
}
function nextFloor() {
  ovOff('floorOv');
  G.floor++; G.hearts = Math.min(5, G.hearts + 2); renderHearts();
  saveActive(); /* Checkpoint: neues Gebiet ist der Wiedereinstiegspunkt */
  document.getElementById('floorTag').textContent = 'GEBIET ' + G.floor;
  announce('GEBIET ' + G.floor, 1200);
  planFloor();
  setTimeout(advance, 700);
}

/* ---------- Button-/Regler-Verdrahtung (statt Inline-onclick) ---------- */
export function wireOverlays() {
  document.querySelectorAll('.adultLink').forEach(b => b.addEventListener('click', openAdult));
  document.getElementById('adultCloseBtn').addEventListener('click', () => ovOff('adultOv'));
  document.getElementById('resumeBtn').addEventListener('click', () => ovOff('pauseOv'));
  document.getElementById('restartBtn').addEventListener('click', () => location.reload());
  document.getElementById('nextFloorBtn').addEventListener('click', nextFloor);
  document.getElementById('setDoneBtn').addEventListener('click', () => ovOff('setOv'));
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('pauseBtn').addEventListener('click', openPause);

  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => setQuality(c.dataset.q === 'auto' ? 'auto' : +c.dataset.q));
  });
  document.getElementById('resSlider').addEventListener('input', e => {
    setRES(e.target.value / 100);
    document.getElementById('resVal').textContent = e.target.value + '%';
  });
  document.getElementById('voiceToggle').addEventListener('click', () => {
    const t = document.getElementById('voiceToggle');
    t.classList.toggle('on');
    setVoiceOn(t.classList.contains('on'));
  });
}
