/* =====================================================================
   MUSIK-GENERATOR (ElevenLabs Music API, einmalig)

   KLANGKONZEPT „WALDLÄUFER" – alles aus einem Guss:
   - Instrumentarium: Harfe, Holzbläser (Flöte/Klarinette), warme
     Streicher, Celesta/Glockenspiel für Magie, leichte Perkussion.
   - Stimmung: kindlich-abenteuerlich, warm, hoffnungsvoll.
     NIE bedrohlich – auch der Boss bleibt „spielerisch dramatisch".
   - Erkundung ruhig (~75 BPM), Boss treibend aber rund (~110 BPM).
   - Alle Stücke instrumental und loopbar.

   Aufruf: npm run music   (inkrementell)
   ===================================================================== */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

const OUT = 'public/assets/music';
const TRACKS = [
  { f: 'theme-title', ms: 90000, p: 'Warm enchanting main theme for a children s forest adventure game. Harp arpeggios, gentle flute melody, soft strings, glockenspiel sparkles. Hopeful, magical, builds gently. Instrumental, seamless loop.' },
  { f: 'explore-bright', ms: 120000, p: 'Peaceful exploration music for a children s fantasy game, light acoustic folk: harp and flute melody over soft warm strings, playful woodwind ornaments like birdsong. Gentle, curious, sunny forest morning. Instrumental, seamless loop, around 75 bpm.' },
  { f: 'explore-dusk', ms: 120000, p: 'Calm mysterious exploration music for a children s fantasy game: deeper woodwinds, warm cello, soft celesta accents, twilight forest mood. Slightly adventurous, wondrous, never scary. Instrumental, seamless loop, around 70 bpm.' },
  { f: 'boss-theme', ms: 90000, p: 'Playfully dramatic boss music for a children s fantasy game: driving low strings, light timpani, mischievous staccato woodwinds, short brass accents. Exciting shadow-creature showdown, energetic but kid-friendly, never frightening. Instrumental, seamless loop, around 110 bpm.' }
];

const env = {};
if (existsSync('.env')) readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/); if (m) env[m[1]] = m[2];
});
const KEY = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('✗ Kein API-Key in .env'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
let made = 0, skipped = 0;
for (const t of TRACKS) {
  const file = `${OUT}/${t.f}.mp3`;
  if (existsSync(file)) { skipped++; continue; }
  console.log(`… generiere ${t.f} (${t.ms / 1000}s, dauert etwas)`);
  const r = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: t.p, music_length_ms: t.ms })
  });
  if (!r.ok) { console.error(`✗ ${t.f}: HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`); continue; }
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  made++;
  console.log(`✓ ${t.f}`);
}
console.log(`\nFertig: ${made} generiert, ${skipped} vorhanden.`);
