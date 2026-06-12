/* ---------- Soundeffekte ----------
   Datei-basiert (ElevenLabs-SFX aus public/assets/sfx/, siehe
   scripts/generate-sfx.mjs) mit WebAudio-Synth als Fallback für
   jeden Sound, der (noch) nicht generiert ist. */
let AC = null;
let SFX_VOL = 1;
try { SFX_VOL = +(localStorage.getItem('waldlaeufer.volSfx') ?? 1); } catch (e) {}
export function setSfxVol(v) {
  SFX_VOL = v;
  try { localStorage.setItem('waldlaeufer.volSfx', String(v)); } catch (e) {}
}
export function getSfxVol() { return SFX_VOL; }

/* ---------- Datei-Player ---------- */
let FILES = null;
export async function loadSfx() {
  try {
    const r = await fetch('/assets/sfx/manifest.json');
    if (r.ok) {
      const list = await r.json();
      FILES = new Set(list);
      list.forEach(f => fetch('/assets/sfx/' + f).catch(() => {})); /* Cache wärmen */
    }
  } catch (e) { /* keine Dateien → Synth-Fallback */ }
}
function playFile(name, vol = 1, rate = 1) {
  if (!FILES || !FILES.has(name + '.mp3')) return false;
  if (SFX_VOL <= 0) return true;
  const a = new Audio('/assets/sfx/' + name + '.mp3');
  a.volume = Math.max(0, Math.min(1, vol * SFX_VOL));
  if (rate !== 1) { try { a.preservesPitch = false; } catch (e) {} a.playbackRate = rate; }
  a.play().catch(() => {});
  return true;
}

/* ---------- Synth-Fallback ---------- */
export function ac() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
export function tone(f, dur = .12, type = 'square', vol = .12, when = 0, slide = 0) {
  vol *= SFX_VOL; if (vol <= 0) return;
  try {
    const a = ac(), t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) {}
}
export function noise(dur = .2, vol = .18, freq = 800, when = 0) {
  vol *= SFX_VOL; if (vol <= 0) return;
  try {
    const a = ac(), t = a.currentTime + when, len = a.sampleRate * dur, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(); s.buffer = buf;
    const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq;
    const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(a.destination); s.start(t);
  } catch (e) {}
}

/* ---------- Spiel-Sounds: Datei zuerst, sonst Synth ---------- */
let stepAlt = false;
export const sndCard   = () => { if (playFile('card-correct')) return; tone(620, .07, 'square', .1); tone(930, .09, 'square', .09, .05); };
export const sndFizzle = () => { if (playFile('card-wrong', .8)) return; tone(300, .16, 'sawtooth', .07, 0, -180); noise(.12, .06, 500); };
export const sndCast   = () => { if (playFile('spell-cast')) return; tone(420, .25, 'sawtooth', .1, 0, 700); noise(.15, .08, 2400, .05); };
export const sndBoom   = () => { if (playFile('spell-hit')) return; noise(.45, .28, 400); tone(80, .4, 'sine', .22, 0, -30); };
export const sndHurt   = () => { if (playFile('player-hit')) return; tone(160, .22, 'sawtooth', .16, 0, -90); noise(.18, .12, 400); };
export const sndHeart  = () => { playFile('heart-lost', .9); };
export const sndBlock  = () => { if (playFile('shield-correct')) return; tone(1100, .08, 'triangle', .14); tone(1500, .12, 'triangle', .12, .06); };
export const sndGem    = (i = 0) => { if (playFile('gem-collect', 1, 1 + i * .07)) return; tone(1200 + i * 150, .09, 'sine', .08, i * .05); };
export const sndCrit   = () => { playFile('critical-sting', .9); };
export const sndWin    = () => { if (playFile('victory-fanfare')) return; [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'square', .11, i * .1)); };
export const sndGrowl  = () => { if (playFile('ghost-appear')) return; tone(95, .5, 'sawtooth', .12, 0, -40); noise(.3, .06, 250, .1); };
export const sndBridge = () => { if (playFile('bridge-grow')) return; [294, 370, 440, 554].forEach((f, i) => tone(f, .14, 'triangle', .12, i * .12)); };
export const sndChest  = () => { if (playFile('chest-open')) return; tone(523, .1, 'triangle', .12); tone(784, .12, 'triangle', .12, .1); tone(1047, .16, 'triangle', .12, .2); };
export const sndStep   = () => { stepAlt = !stepAlt; if (playFile(stepAlt ? 'footstep-1' : 'footstep-2', .55)) return; noise(.06, .035, 450); };
export const sndBird   = () => { if (playFile('bird-chirp', .4)) return; tone(2200, .08, 'sine', .04, 0, 400); tone(2600, .07, 'sine', .03, .12, -300); };
export const sndFree   = () => { if (playFile('animal-free')) return; [523, 659, 784, 880, 1175].forEach((f, i) => tone(f, .16, 'triangle', .12, i * .09)); };
export const sndTap    = () => { playFile('ui-tap', .6); };
