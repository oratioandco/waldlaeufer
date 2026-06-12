/* =====================================================================
   MUSIK – Titelsong + Level-Tracks mit Crossfade und Voice-Ducking.
   Die Stimme muss IMMER verständlich bleiben → während Sprach-Clips
   wird die Musik automatisch leiser gezogen.
   ===================================================================== */
const TRACKS = {
  title: '/assets/music/title.mp3',
  levels: ['/assets/music/grove.mp3', '/assets/music/cursed-glades.mp3']
};
let MUSIC_VOL = .35;
try { MUSIC_VOL = +(localStorage.getItem('waldlaeufer.volMusic') ?? .35); } catch (e) {}

let current = null;       // aktives Audio-Element
let currentKey = null;
let ducked = false;

function targetVol() { return MUSIC_VOL * (ducked ? .25 : 1); }

/* Fade-Timer PRO Audio-Element – ein globaler Timer würde parallele
   Fades (Titel raus + Level rein) gegenseitig abwürgen */
function fadeTo(audio, vol, ms, onDone) {
  clearInterval(audio._fade);
  const from = audio.volume, steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  audio._fade = setInterval(() => {
    i++;
    audio.volume = Math.max(0, Math.min(1, from + (vol - from) * (i / steps)));
    if (i >= steps) { clearInterval(audio._fade); if (onDone) onDone(); }
  }, 50);
}

function play(key, src) {
  if (currentKey === key) return;
  currentKey = key;
  const next = new Audio(src);
  next.loop = true;
  next.volume = 0;
  next.play().catch(() => { currentKey = null; }); // Autoplay-Block → später erneut
  const prev = current;
  current = next;
  if (prev) {
    fadeTo(prev, 0, 900, () => prev.pause());
    setTimeout(() => fadeTo(next, targetVol(), 900), 250);
  } else {
    fadeTo(next, targetVol(), 1200);
  }
}

export function playTitleMusic() { play('title', TRACKS.title); }
/* Level-Track wechselt je Gebiet (1: hell, 2: düster, dann im Wechsel) */
export function playLevelMusic(floor) {
  const i = (floor - 1) % TRACKS.levels.length;
  play('level' + i, TRACKS.levels[i]);
}
export function stopMusic() {
  if (current) { const c = current; fadeTo(c, 0, 600, () => c.pause()); }
  current = null; currentKey = null;
}

/* Voice-Ducking: Sprache hat immer Vorrang */
export function duckMusic(on) {
  ducked = on;
  if (current) fadeTo(current, targetVol(), on ? 200 : 700);
}
export function setMusicVol(v) {
  MUSIC_VOL = v;
  try { localStorage.setItem('waldlaeufer.volMusic', String(v)); } catch (e) {}
  if (current) current.volume = targetVol();
}
export function getMusicVol() { return MUSIC_VOL; }
