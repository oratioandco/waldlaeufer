/* =====================================================================
   SZENEN-SYSTEM – Dialog-Banner unten, die 3D-Welt bleibt sichtbar.
   Vorgelesen; Text per Toggle einblendbar (freiwilliges Zusatzlesen,
   nie Pflicht-Lesehürde). Tap auf das Banner oder ▶ = weiter;
   ⏭ überspringt mehrteilige Szenen komplett (schneller Einstieg).
   Dazu: Sprechblase für beiläufige Kommentare (blockiert nie).
   ===================================================================== */
import { sayStory, stopSpeech } from '../audio/tts.js';

let queue = [], idx = 0, onDoneCb = null;
let TEXT_ON = false;
try { TEXT_ON = localStorage.getItem('waldlaeufer.sceneText') === '1'; } catch (e) {}

export function initScenes() {
  applyTextPref();
  document.getElementById('sceneTextBtn').addEventListener('click', e => {
    e.stopPropagation();
    TEXT_ON = !TEXT_ON;
    try { localStorage.setItem('waldlaeufer.sceneText', TEXT_ON ? '1' : '0'); } catch (e2) {}
    applyTextPref();
  });
  document.getElementById('sceneSkipBtn').addEventListener('click', e => {
    e.stopPropagation();
    skipScene();
  });
  document.getElementById('sceneNextBtn').addEventListener('pointerdown', e => {
    e.stopPropagation();
    next();
  });
  /* das ganze Banner ist Weiter-Fläche (große Trefferfläche für Kinder) */
  document.getElementById('sceneCard').addEventListener('pointerdown', next);
}
function applyTextPref() {
  document.getElementById('sceneText').classList.toggle('hidden', !TEXT_ON);
  document.getElementById('sceneTextBtn').textContent = TEXT_ON ? '💬 Text verbergen' : '💬 Text zeigen';
}

export function playScene(steps, onDone) {
  queue = steps; idx = 0; onDoneCb = onDone || null;
  document.getElementById('sceneOv').classList.add('on');
  /* Überspringen nur bei mehrteiligen Szenen anbieten (z.B. Intro) */
  document.getElementById('sceneSkipBtn').classList.toggle('hidden', steps.length < 2);
  showStep();
}
function showStep() {
  const s = queue[idx];
  document.getElementById('sceneIcon').textContent = s.icon;
  document.getElementById('sceneSpeaker').textContent = s.name;
  document.getElementById('sceneText').textContent = s.text;
  /* WEITER = bewusstes Überspringen → laufende Zeile sofort abbrechen */
  sayStory(s.voice, s.text, true);
  document.getElementById('sceneNextBtn').textContent = idx < queue.length - 1 ? '▶' : '⚔';
}
function next() {
  idx++;
  if (idx < queue.length) { showStep(); return; }
  document.getElementById('sceneOv').classList.remove('on');
  /* letzte Zeile darf ausklingen – Folge-Sprache reiht sich in die Queue ein */
  const cb = onDoneCb; onDoneCb = null;
  if (cb) cb();
}
function skipScene() {
  stopSpeech();
  idx = queue.length;
  document.getElementById('sceneOv').classList.remove('on');
  const cb = onDoneCb; onDoneCb = null;
  if (cb) cb();
}

/* ---------- Sprechblase (nicht-blockierend) ---------- */
let bubbleTimer = null;
export function showBubble(icon, text, voice = 'companion') {
  const b = document.getElementById('bubble');
  document.getElementById('bubbleIcon').textContent = icon;
  document.getElementById('bubbleText').textContent = text;
  b.classList.add('on');
  sayStory(voice, text);
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('on'), 3500);
}
