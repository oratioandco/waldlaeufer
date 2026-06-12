/* ---------- Overlays: Pause, Einstellungen, Gebiet geschafft,
   Eltern-Panel mit Live-Lern-Report ---------- */
import { G } from '../state.js';
import { SESSION, activeTier, tierMastery, TIER_NAMES } from '../learning/engine.js';
import { BOSSES } from '../creatures/data.js';
import { planFloor, advance } from '../world/stations.js';
import { biomeFor } from '../world/biomes.js';
import { renderHearts } from './hud.js';
import { announce } from './feedback.js';
import { setVoiceOn, setVoiceVol, getVoiceVol, sayStorySeq } from '../audio/tts.js';
import { sndWin, setSfxVol, getSfxVol, sndGem, sndTap } from '../audio/sfx.js';
import { setMusicVol, getMusicVol, playLevelMusic } from '../audio/music.js';
import { refreshAmbience } from '../audio/ambience.js';
import { setQuality, setRES } from '../engine/quality.js';
import { saveActive } from '../meta/save.js';
import { FLOOR_QUOTES, FLOOR_DONE, FLOOR_DONE_ALL } from '../story/content.js';

export function ovOn(id) { document.getElementById(id).classList.add('on'); }
export function ovOff(id) { document.getElementById(id).classList.remove('on'); }

export function openPause() {
  document.getElementById('pauseStats').innerHTML = `
    <div class="stat"><div class="n">${G.gems}</div><div class="l">💎 KRISTALLE</div></div>
    <div class="stat"><div class="n">${G.kills}</div><div class="l">TIERE BEFREIT</div></div>
    <div class="stat"><div class="n">${G.trophies.length}</div><div class="l">WÄCHTER</div></div>`;
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
  const boss = BOSSES[Math.min(G.floor - 1, BOSSES.length - 1)];
  document.getElementById('floorSub').innerHTML =
    `Du hast den Schatten gebrochen –<br><b style="color:#e9d5ff">${boss.freed}</b> ist wieder frei und beschützt den Wald:` +
    (G.companion ? `<br><i style="color:#b8ffd9">${G.companion.icon} „${quote}"</i>` : '');
  document.getElementById('trophyRow').textContent = G.trophies.join(' ');
  document.getElementById('floorStats').innerHTML = `
    <div class="stat"><div class="n">${G.gems}</div><div class="l">💎 GESAMT</div></div>
    <div class="stat"><div class="n">${G.kills}</div><div class="l">TIERE BEFREIT</div></div>
    <div class="stat"><div class="n">${G.trophies.length}</div><div class="l">WÄCHTER</div></div>`;
  ovOn('floorOv');
  /* Runden-Abschluss (alle 6 Wächter): großer Moment + Überleitung */
  const allFreed = G.floor % 6 === 0;
  const seq = [{ voice: 'narrator', text: allFreed ? FLOOR_DONE_ALL : FLOOR_DONE }];
  if (G.companion && !allFreed) seq.push({ voice: 'companion', text: quote });
  sayStorySeq(seq);
}
function nextFloor() {
  ovOff('floorOv');
  G.floor++; G.hearts = Math.min(5, G.hearts + 2); renderHearts();
  playLevelMusic(G.floor); /* Track-Wechsel je Gebiet (hell/düster) */
  saveActive(); /* Checkpoint: neues Gebiet ist der Wiedereinstiegspunkt */
  /* Biom-Name als freiwilliges Zusatzlesen (schöne Komposita!) */
  document.getElementById('floorTag').textContent = 'GEBIET ' + G.floor + ' · ' + biomeFor(G.floor).name;
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

  /* Getrennte Lautstärken für Stimme/Musik/Effekte (persistiert) */
  const vols = [
    ['volVoice', getVoiceVol, setVoiceVol, null],
    ['volMusic', getMusicVol, setMusicVol, refreshAmbience],
    ['volSfx', getSfxVol, setSfxVol, () => sndGem(0)] /* Hör-Feedback */
  ];
  vols.forEach(([id, get, set, sample]) => {
    const el = document.getElementById(id);
    el.value = Math.round(get() * 100);
    el.addEventListener('input', e => set(e.target.value / 100));
    if (sample) el.addEventListener('change', sample);
  });

  /* dezentes Tap-Feedback auf allen statischen Buttons */
  document.querySelectorAll('.play, .ghost, .chip, #settingsBtn, #pauseBtn, #hornBtn').forEach(b =>
    b.addEventListener('pointerdown', sndTap));
}
