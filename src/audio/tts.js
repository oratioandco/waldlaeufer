/* ---------- Sprachausgabe mit Abspiel-Queue ----------
   Regeln:
   - Ein laufender Clip wird IMMER zu Ende gespielt.
   - Wartende Clips spielen danach in REIHENFOLGE (FIFO).
   - Kappe gegen Rückstau: max. 4 wartende; läuft sie über, fällt
     der älteste wartende weg.
   - optional=true (reine Würz-Sounds wie das Angriffs-Signal) wird
     gar nicht erst eingereiht, wenn schon gesprochen wird.
   - interrupt=true (Szenen-WEITER = bewusstes Überspringen) bricht
     sofort ab und leert die Warteschlange.

   Drei Wege, alle mit Musik-Ducking (Stimme bleibt IMMER verständlich):
   1. sayGame():  gebackene ElevenLabs-Clips für Wörter, Silben,
      Schildwörter und feste Gameplay-Sätze (Lehrer-Stimme).
   2. sayStory(): gebackene Clips für Story-Zeilen (Charakterstimmen).
   3. say():      Web Speech API (de-DE) – Fallback für alles, was
      (noch) keinen Clip hat, z.B. neue Förderwörter der Therapeutin
      vor dem nächsten `npm run voices`-Lauf.   */
import { VOICES } from '../story/content.js';
import { duckMusic } from './music.js';
import { duckAmbience } from './ambience.js';

/* Sprache duckt Musik UND Umgebungsgeräusche */
function duckAll(on) { duckMusic(on); duckAmbience(on); }

export let VOICE_ON = true;
let VOICE_VOL = 1;
try { VOICE_VOL = +(localStorage.getItem('waldlaeufer.volVoice') ?? 1); } catch (e) {}
let MANIFEST = null;
let curAudio = null;
let current = null;   // laufender Job
let queue = [];       // wartende Jobs (FIFO)
const MAX_QUEUE = 4;

export function setVoiceOn(on) {
  VOICE_ON = on;
  if (!on) { queue = []; hardStop(); }
}
export function setVoiceVol(v) {
  VOICE_VOL = v;
  try { localStorage.setItem('waldlaeufer.volVoice', String(v)); } catch (e) {}
  if (curAudio) curAudio.volume = v;
}
export function getVoiceVol() { return VOICE_VOL; }

/* ---------- Queue-Kern ---------- */
function hardStop() {
  if (curAudio) { curAudio.onended = curAudio.onerror = null; curAudio.pause(); curAudio = null; }
  try { speechSynthesis.cancel(); } catch (e) {}
  if (current) { clearTimeout(current._t); current = null; }
  duckAll(false);
}
function startJob(job) {
  current = job;
  duckAll(true);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(job._t);
    curAudio = null;
    current = null;
    if (queue.length) startJob(queue.shift());
    else duckAll(false);
  };
  /* Sicherheitsnetz: falls onended/onend nie feuert (iOS-Eigenheiten),
     gibt der Timer die Queue wieder frei */
  job._t = setTimeout(finish, job.maxMs);
  job.run(finish);
}
function requestJob(job, interrupt = false, optional = false) {
  if (!VOICE_ON) return;
  if (interrupt) { queue = []; hardStop(); startJob(job); return; }
  if (current) {
    if (optional) return; /* Würz-Sound bei Stau: weglassen statt stapeln */
    queue.push(job);
    while (queue.length > MAX_QUEUE) queue.shift();
    return;
  }
  startJob(job);
}

/* ---------- Job-Typen ---------- */
function speechRun(text, rate, pitch) {
  return finish => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; u.rate = rate; u.pitch = pitch; u.volume = VOICE_VOL;
      const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('de'));
      if (v) u.voice = v;
      u.onend = u.onerror = finish;
      speechSynthesis.speak(u);
    } catch (e) { finish(); }
  };
}
function speechJob(text, rate = .95, pitch = .9) {
  return { run: speechRun(text, rate, pitch), maxMs: Math.max(3000, text.length * 150) };
}
function clipJob(file, fbText, fbRate, fbPitch) {
  return {
    maxMs: 20000,
    run: finish => {
      curAudio = new Audio('/assets/voice/' + file);
      curAudio.volume = VOICE_VOL;
      curAudio.onended = curAudio.onerror = finish;
      curAudio.play().catch(() => speechRun(fbText, fbRate, fbPitch)(finish));
    }
  };
}
function seqJob(steps) {
  return {
    maxMs: 20000 * steps.length,
    run: finish => {
      let i = 0;
      const next = () => {
        if (i >= steps.length) { finish(); return; }
        const s = steps[i++];
        const f = clipFor(s.voice, s.text);
        if (!f) { /* Rest als ein Fallback-Satz sprechen */
          const v = VOICES[s.voice] || VOICES.narrator;
          speechRun([s.text, ...steps.slice(i).map(x => x.text)].join(' '), v.rate, v.pitch)(finish);
          return;
        }
        curAudio = new Audio('/assets/voice/' + f);
        curAudio.volume = VOICE_VOL;
        curAudio.onended = next;
        curAudio.onerror = next;
        curAudio.play().catch(next);
      };
      next();
    }
  };
}

/* ---------- Manifest ---------- */
export async function loadVoiceManifest() {
  try {
    const r = await fetch('/assets/voice/manifest.json');
    if (r.ok) {
      MANIFEST = await r.json();
      /* Clips vorladen (HTTP-Cache wärmen): Wiedergabe startet dann auch
         vollständig, wenn der Hauptthread gerade beschäftigt ist */
      Object.values(MANIFEST).forEach(f => fetch('/assets/voice/' + f).catch(() => {}));
    }
  } catch (e) { /* kein Manifest → Web-Speech-Fallback */ }
}
function clipFor(voiceKey, text) {
  return MANIFEST && MANIFEST[voiceKey + '|' + text];
}

/* ---------- Öffentliche API ---------- */
export function say(text, rate = .95, pitch = .9, interrupt = false) {
  requestJob(speechJob(text, rate, pitch), interrupt);
}
if ('speechSynthesis' in window) speechSynthesis.getVoices();

/* Gameplay: Wörter, Silben, Schildwörter, feste Sätze (Lehrer-Stimme) */
export function sayGame(text, interrupt = false, optional = false) {
  const f = clipFor('word', text);
  requestJob(f ? clipJob(f, text, .95, .9) : speechJob(text), interrupt, optional);
}
/* Story-Zeilen (Charakterstimmen) */
export function sayStory(voiceKey, text, interrupt = false, optional = false) {
  const v = VOICES[voiceKey] || VOICES.narrator;
  const f = clipFor(voiceKey, text);
  requestJob(f ? clipJob(f, text, v.rate, v.pitch) : speechJob(text, v.rate, v.pitch), interrupt, optional);
}
/* Mehrere Zeilen nacheinander (z.B. Erzähler + Begleiter-Zitat) */
export function sayStorySeq(steps) {
  if (!steps.length) return;
  requestJob(seqJob(steps));
}
