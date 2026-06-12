/* =====================================================================
   MUSIK – Titelsong + Level-Tracks mit Crossfade und Voice-Ducking.
   Die Stimme muss IMMER verständlich bleiben → während Sprach-Clips
   wird die Musik automatisch leiser gezogen.
   ===================================================================== */
/* Generierte Stücke (Klangkonzept in scripts/generate-music.mjs) mit
   Fallback auf die ursprünglich hinzugefügten Tracks */
const TRACKS = {
  title: '/assets/music/theme-title.mp3',
  titleFallback: '/assets/music/title.mp3',
  levels: ['/assets/music/explore-bright.mp3', '/assets/music/explore-dusk.mp3'],
  levelsFallback: ['/assets/music/grove.mp3', '/assets/music/cursed-glades.mp3'],
  boss: '/assets/music/boss-theme.mp3'
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

function play(key, src, fallbackSrc) {
  if (currentKey === key) return;
  currentKey = key;
  const next = new Audio(src);
  next.loop = true;
  next.volume = 0;
  if (fallbackSrc) next.onerror = () => { next.onerror = null; next.src = fallbackSrc; next.play().catch(() => {}); };
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

export function playTitleMusic() { play('title', TRACKS.title, TRACKS.titleFallback); }
/* Level-Track wechselt je Gebiet (hell/dämmrig im Wechsel) */
export function playLevelMusic(floor) {
  const i = (floor - 1) % TRACKS.levels.length;
  play('level' + i, TRACKS.levels[i], TRACKS.levelsFallback[i]);
}
/* Eigenes Boss-Thema (Roadmap 4) – fällt ohne Datei auf Level-Track zurück */
export function playBossMusic(floor) {
  play('boss', TRACKS.boss, TRACKS.levels[(floor - 1) % TRACKS.levels.length]);
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
