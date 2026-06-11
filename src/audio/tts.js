/* ---------- Sprachausgabe ----------
   Drei Wege, alle mit Musik-Ducking (Stimme bleibt IMMER verständlich):
   1. sayGame():  gebackene ElevenLabs-Clips für Wörter, Silben,
      Schildwörter und feste Gameplay-Sätze (Lehrer-Stimme).
   2. sayStory(): gebackene Clips für Story-Zeilen (Charakterstimmen).
   3. say():      Web Speech API (de-DE) – Fallback für alles, was
      (noch) keinen Clip hat, z.B. neue Förderwörter der Therapeutin
      vor dem nächsten `npm run voices`-Lauf.   */
import { VOICES } from '../story/content.js';
import { duckMusic } from './music.js';

export let VOICE_ON = true;
let VOICE_VOL = 1;
try { VOICE_VOL = +(localStorage.getItem('waldlaeufer.volVoice') ?? 1); } catch (e) {}
let MANIFEST = null;
let curAudio = null;

export function setVoiceOn(on) {
  VOICE_ON = on;
  if (!on) stopVoice();
}
export function setVoiceVol(v) {
  VOICE_VOL = v;
  try { localStorage.setItem('waldlaeufer.volVoice', String(v)); } catch (e) {}
  if (curAudio) curAudio.volume = v;
}
export function getVoiceVol() { return VOICE_VOL; }

function stopVoice() {
  if (curAudio) { curAudio.pause(); curAudio = null; }
  try { speechSynthesis.cancel(); } catch (e) {}
  duckMusic(false);
}

export function say(text, rate = .95, pitch = .9) {
  if (!VOICE_ON) return;
  stopVoice();
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; u.rate = rate; u.pitch = pitch; u.volume = VOICE_VOL;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('de'));
    if (v) u.voice = v;
    duckMusic(true);
    u.onend = u.onerror = () => duckMusic(false);
    speechSynthesis.speak(u);
  } catch (e) { duckMusic(false); }
}
if ('speechSynthesis' in window) speechSynthesis.getVoices();

/* ---------- Gebackene Clips ---------- */
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
function playClip(file) {
  stopVoice();
  curAudio = new Audio('/assets/voice/' + file);
  curAudio.volume = VOICE_VOL;
  duckMusic(true);
  curAudio.onended = curAudio.onerror = () => duckMusic(false);
  return curAudio.play();
}
function speechFallback(voiceKey, text) {
  const v = VOICES[voiceKey] || VOICES.narrator;
  say(text, v.rate, v.pitch);
}

/* Gameplay: Wörter, Silben, Schildwörter, feste Sätze (Lehrer-Stimme) */
export function sayGame(text) {
  if (!VOICE_ON) return;
  const f = clipFor('word', text);
  if (!f) { say(text); return; }
  playClip(f).catch(() => say(text));
}
/* Story-Zeilen (Charakterstimmen) */
export function sayStory(voiceKey, text) {
  if (!VOICE_ON) return;
  const f = clipFor(voiceKey, text);
  if (!f) { speechFallback(voiceKey, text); return; }
  playClip(f).catch(() => speechFallback(voiceKey, text));
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
  duckMusic(true);
  let i = 0;
  const playNext = () => {
    if (i >= steps.length) { curAudio = null; duckMusic(false); return; }
    const s = steps[i++];
    curAudio = new Audio('/assets/voice/' + clipFor(s.voice, s.text));
    curAudio.volume = VOICE_VOL;
    curAudio.onended = playNext;
    curAudio.onerror = () => duckMusic(false);
    curAudio.play().catch(() => duckMusic(false));
  };
  playNext();
}
