/* ---------- Sprachausgabe ----------
   Zwei Wege:
   1. say(): Web Speech API (de-DE) – für die therapie-kritischen
      Zauberwörter/Silben (sofort, beliebige Wörter, offline).
   2. sayStory(): vorgenerierte ElevenLabs-Clips für feste Story-Zeilen
      (public/assets/voice/, siehe scripts/generate-voices.mjs).
      Fehlt ein Clip → automatischer Fallback auf Web Speech. */
import { VOICES } from '../story/content.js';

export let VOICE_ON = true;
let MANIFEST = null;
let curAudio = null;

export function setVoiceOn(on) {
  VOICE_ON = on;
  if (!on) stopVoice();
}
function stopVoice() {
  if (curAudio) { curAudio.pause(); curAudio = null; }
  try { speechSynthesis.cancel(); } catch (e) {}
}

export function say(text, rate = .95, pitch = .9) {
  if (!VOICE_ON) return;
  stopVoice();
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; u.rate = rate; u.pitch = pitch;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('de'));
    if (v) u.voice = v; speechSynthesis.speak(u);
  } catch (e) {}
}
if ('speechSynthesis' in window) speechSynthesis.getVoices();

/* ---------- Story-Stimmen (gebackene Clips) ---------- */
export async function loadVoiceManifest() {
  try {
    const r = await fetch('/assets/voice/manifest.json');
    if (r.ok) {
      MANIFEST = await r.json();
      /* Clips vorladen (HTTP-Cache wärmen): Wiedergabe startet dann auch
         vollständig, wenn der Hauptthread gerade beschäftigt ist
         (z.B. Shader-Kompilierung beim ersten Start) */
      Object.values(MANIFEST).forEach(f => fetch('/assets/voice/' + f).catch(() => {}));
    }
  } catch (e) { /* kein Manifest → Web-Speech-Fallback */ }
}
function clipFor(voiceKey, text) {
  return MANIFEST && MANIFEST[voiceKey + '|' + text];
}
function speechFallback(voiceKey, text) {
  const v = VOICES[voiceKey] || VOICES.narrator;
  say(text, v.rate, v.pitch);
}
export function sayStory(voiceKey, text) {
  if (!VOICE_ON) return;
  const f = clipFor(voiceKey, text);
  if (!f) { speechFallback(voiceKey, text); return; }
  stopVoice();
  curAudio = new Audio('/assets/voice/' + f);
  curAudio.play().catch(() => speechFallback(voiceKey, text));
}
/* Mehrere Zeilen nacheinander (z.B. Erzähler + Begleiter-Zitat).
   Nur wenn alle Clips vorliegen wird verkettet, sonst ein Fallback-Satz. */
export function sayStorySeq(steps) {
  if (!VOICE_ON || !steps.length) return;
  if (!steps.every(s => clipFor(s.voice, s.text))) {
    speechFallback(steps[0].voice, steps.map(s => s.text).join(' '));
    return;
  }
  stopVoice();
  let i = 0;
  const playNext = () => {
    if (i >= steps.length) { curAudio = null; return; }
    const s = steps[i++];
    curAudio = new Audio('/assets/voice/' + clipFor(s.voice, s.text));
    curAudio.onended = playNext;
    curAudio.play().catch(() => {});
  };
  playNext();
}
