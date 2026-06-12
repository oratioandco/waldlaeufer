/* =====================================================================
   AMBIENCE – Wald-Atmosphäre als Klangschicht
   Tag-/Dämmerungs-Loop crossfaden mit dem Tageszeit-Fortschritt,
   Bach nur an der Tor-Station, Schatten-Aura nur in der Boss-Arena.
   Lautstärke hängt am Musik-Regler (Ambience ist Teil der Kulisse).
   ===================================================================== */
import { getMusicVol } from './music.js';

const SRC = {
  day:   '/assets/sfx/ambience-forest-day.mp3',
  dusk:  '/assets/sfx/ambience-forest-dusk.mp3',
  creek: '/assets/sfx/creek-water.mp3',
  aura:  '/assets/sfx/boss-aura.mp3'
};
const els = {};       // lazily erzeugte, loopende Audio-Elemente
let progress = 0;     // 0 Morgen … 1 Dämmerung
let creekOn = false, auraOn = false;
let started = false;

function el(key) {
  if (!els[key]) {
    const a = new Audio(SRC[key]);
    a.loop = true; a.volume = 0;
    a.onerror = () => { els[key] = 'missing'; };
    els[key] = a;
  }
  return els[key] === 'missing' ? null : els[key];
}
function apply() {
  if (!started) return;
  const base = getMusicVol() * .9; /* Kulisse knapp unter Musik-Level */
  const want = {
    day:   base * (1 - progress) * .8,
    dusk:  base * progress * .8,
    creek: creekOn ? base * .9 : 0,
    aura:  auraOn ? base * .8 : 0
  };
  Object.entries(want).forEach(([k, v]) => {
    const a = el(k);
    if (!a) return;
    if (v > 0 && a.paused) a.play().catch(() => {});
    a.volume = Math.max(0, Math.min(1, v));
    if (v === 0 && !a.paused) a.pause();
  });
}

export function startAmbience() { started = true; apply(); }
export function setAmbienceProgress(p) { progress = Math.max(0, Math.min(1, p)); apply(); }
export function setCreek(on) { creekOn = on; apply(); }
export function setBossAura(on) { auraOn = on; apply(); }
export function refreshAmbience() { apply(); }
