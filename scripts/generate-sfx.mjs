/* =====================================================================
   SFX-GENERATOR (ElevenLabs Sound-Generation-API, einmalig)
   Erzeugt alle Spiel-Soundeffekte nach public/assets/sfx/ inkl.
   manifest.json. Designlinie: warm, magisch, nie gruselig oder
   bestrafend (Fehler-Sounds bewusst sanft – Therapie-Invariante).
   Aufruf: npm run sfx   (inkrementell, vorhandene Dateien bleiben)
   ===================================================================== */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

const OUT = 'public/assets/sfx';

const SFX = [
  /* Gameplay-Kern */
  { f: 'card-correct',   d: 0.8, p: 'Soft magical chime pluck, warm wooden marimba note with a tiny sparkle tail, positive feedback, children s game, short' },
  { f: 'card-wrong',     d: 1.0, p: 'Soft gentle magical fizzle, small puff of air with two descending friendly woodwind notes, mild, no harshness' },
  { f: 'spell-cast',     d: 1.0, p: 'Quick clean magical whoosh, a glowing energy orb launching forward with a bright shimmer trail, polished fantasy game spell sound, no voices' },
  { f: 'spell-hit',      d: 1.0, p: 'Round magical impact: soft deep boom with glittering fairy dust sparkles scattering, satisfying video game hit confirm, pleasing, no harshness, no voices' },
  { f: 'shield-correct', d: 1.0, p: 'Bright crystal shield ting, magical deflection chime, heroic, short' },
  { f: 'player-hit',     d: 1.0, p: 'Soft cartoonish bonk with a brief dizzy wobble, mild setback sound for a kids game, not scary' },
  { f: 'heart-lost',     d: 1.2, p: 'Soft sad descending three-note flute phrase, gentle and brief, kids game' },
  { f: 'gem-collect',    d: 0.6, p: 'Single crystal gem pickup, bright glassy sparkle note, video game collectible, very short' },
  { f: 'critical-sting', d: 1.0, p: 'Powerful magical critical hit sting, bright triumphant zing with sparkle burst, short and punchy' },
  { f: 'victory-fanfare', d: 3.0, p: 'Short triumphant fanfare with woodwinds, harp and light percussion, forest fantasy, joyful children s game victory' },
  /* Welt & Stationen */
  { f: 'ghost-appear',   d: 1.5, p: 'Playful shadow spirit whoosh with a soft mischievous grumble, magical dark puff, slightly spooky but kid-friendly' },
  { f: 'animal-free',    d: 2.5, p: 'Magical liberation shimmer, rising harp glissando with fluttering bird wings taking off, joyful release' },
  { f: 'bridge-grow',    d: 2.0, p: 'Wooden planks magically growing and snapping into place, creaking wood with magical shimmer' },
  { f: 'chest-open',     d: 1.5, p: 'Old wooden treasure chest creaking open followed by a golden sparkle reveal' },
  { f: 'footstep-1',     d: 0.5, p: 'Single soft footstep on a dirt forest path, natural, very short' },
  { f: 'footstep-2',     d: 0.5, p: 'Single soft footstep on a dirt forest path with slight gravel, natural, very short' },
  { f: 'bird-chirp',     d: 1.0, p: 'Single cheerful songbird chirp phrase, two short tweets, forest bird' },
  { f: 'ui-tap',         d: 0.5, p: 'Tiny soft wooden tap click, friendly UI button, very short' },
  /* Ambience-Loops */
  { f: 'ambience-forest-day',  d: 20, loop: true, p: 'Peaceful forest ambience, gentle songbirds, soft wind in leaves, distant insects, daytime, seamless loop' },
  { f: 'ambience-forest-dusk', d: 20, loop: true, p: 'Calm evening forest ambience, crickets, soft owl hoots, gentle breeze, mysterious but peaceful, seamless loop' },
  { f: 'creek-water',          d: 15, loop: true, p: 'Small babbling forest creek, gentle water flowing over stones, seamless loop' },
  { f: 'boss-aura',            d: 12, loop: true, p: 'Low dark magical humming aura, slow pulsing shadow energy, ominous but soft and kid-friendly, seamless loop' }
];

const env = {};
if (existsSync('.env')) readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/); if (m) env[m[1]] = m[2];
});
const KEY = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('✗ Kein API-Key in .env'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
let made = 0, skipped = 0, failed = 0;
for (const s of SFX) {
  const file = `${OUT}/${s.f}.mp3`;
  if (existsSync(file)) { skipped++; continue; }
  const body = { text: s.p, duration_seconds: s.d, prompt_influence: .35 };
  if (s.loop) body.loop = true;
  let r = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok && s.loop) { /* ältere API-Version ohne loop-Parameter */
    delete body.loop;
    r = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  if (!r.ok) { console.error(`✗ ${s.f}: HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`); failed++; continue; }
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  made++;
  console.log(`✓ ${s.f} (${s.d}s)`);
}
/* Manifest enthält NUR real existierende Dateien – sonst würde der
   Laufzeit-Player auf Phantom-Dateien zeigen und der Synth-Fallback
   fälschlich übersprungen */
const available = SFX.map(s => s.f + '.mp3').filter(f => existsSync(`${OUT}/${f}`));
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(available, null, 1));
console.log(`\nFertig: ${made} generiert, ${skipped} vorhanden, ${failed} fehlgeschlagen, Manifest: ${available.length}.`);
