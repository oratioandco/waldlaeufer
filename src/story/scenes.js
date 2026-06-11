/* =====================================================================
   SZENEN-SYSTEM
   Kurze, vorgelesene Story-Szenen mit Weiter-Button. Text ist per
   Toggle einblendbar (Voreinstellung: aus) – freiwilliges Zusatzlesen,
   nie Pflicht-Lesehürde. Dazu: Sprechblase für beiläufige Kommentare
   des Begleiter-Tiers (blockiert nie den Spielfluss).
   ===================================================================== */
import { sayStory } from '../audio/tts.js';

let queue = [], idx = 0, onDoneCb = null;
let TEXT_ON = false;
try { TEXT_ON = localStorage.getItem('waldlaeufer.sceneText') === '1'; } catch (e) {}

export function initScenes() {
  applyTextPref();
  document.getElementById('sceneTextBtn').addEventListener('click', () => {
    TEXT_ON = !TEXT_ON;
    try { localStorage.setItem('waldlaeufer.sceneText', TEXT_ON ? '1' : '0'); } catch (e) {}
    applyTextPref();
  });
  document.getElementById('sceneNextBtn').addEventListener('pointerdown', next);
}
function applyTextPref() {
  document.getElementById('sceneText').classList.toggle('hidden', !TEXT_ON);
  document.getElementById('sceneTextBtn').textContent = TEXT_ON ? '💬 Text verbergen' : '💬 Text zeigen';
}

export function playScene(steps, onDone) {
  queue = steps; idx = 0; onDoneCb = onDone || null;
  document.getElementById('sceneOv').classList.add('on');
  showStep();
}
function showStep() {
  const s = queue[idx];
  document.getElementById('sceneIcon').textContent = s.icon;
  document.getElementById('sceneSpeaker').textContent = s.name;
  document.getElementById('sceneText').textContent = s.text;
  /* WEITER = bewusstes Überspringen → laufende Zeile sofort abbrechen */
  sayStory(s.voice, s.text, true);
  document.getElementById('sceneNextBtn').innerHTML =
    idx < queue.length - 1 ? '▶ &nbsp;WEITER' : '⚔ &nbsp;LOS!';
}
function next() {
  idx++;
  if (idx < queue.length) { showStep(); return; }
  document.getElementById('sceneOv').classList.remove('on');
  /* letzte Zeile darf ausklingen – Folge-Sprache reiht sich in die Queue ein */
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
