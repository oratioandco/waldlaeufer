/* =====================================================================
   STIMMEN-GENERATOR (einmalig beim Entwickeln, ElevenLabs)
   Liest alle festen Story-Zeilen aus src/story/content.js, generiert
   pro Zeile eine MP3 mit der passenden Charakterstimme und schreibt
   public/assets/voice/manifest.json für die Laufzeit-Zuordnung.

   Aufruf:   npm run voices          (generiert nur fehlende Clips)
             npm run voices -- --list   (verfügbare Stimmen anzeigen)

   Die MP3s werden ins Repo committet → der Client braucht weder
   API-Key noch Internet-TTS (DSGVO: keine Laufzeit-Daten an Dritte).
   ===================================================================== */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { INTRO, BOSS_DEFEAT, BOSS_RAGE, COMPANION_CHEER, FLOOR_QUOTES, FLOOR_DONE, FLOOR_DONE_ALL, UI_LINES, bossIntroScene, companionJoinScene } from '../src/story/content.js';
import { BEFEHL_VERBS, zauberePhrase, syllableRead, shieldWas, befehlOne, befehlTwo, befehlHelp, FIXED_GAMEPLAY } from '../src/learning/speech-lines.js';
import { COLORS } from '../src/world/colors.js';

/* Stimmen-Zuordnung (ElevenLabs Premade-Voices, alle Deutsch-fähig
   via eleven_multilingual_v2). Mit `--list` alle verfügbaren ansehen
   und hier nach Geschmack tauschen. */
const VOICE_IDS = {
  narrator:  '5KvpaGteYkNayiswuX2h', // vom Nutzer gewählte Erzähler-Stimme
  boss:      'nPczCjzI2devNBz1zQrb', // Brian – tiefer, voller (Schatten-Wächter)
  companion: 'FGY2WhTYpPnrIDTdsKH5', // Laura – hell, lebhaft (Begleiter-Tier)
  word:      '5KvpaGteYkNayiswuX2h'  // Lehrer-Stimme: Wörter, Silben, Gameplay-Sätze
};
const MODEL = 'eleven_multilingual_v2';
/* Aussprache-Übersteuerung für Problemsilben: GESPROCHEN wird der
   rechte Wert, der Manifest-Key (und die Karte) bleibt der linke.
   Bei weiteren Englisch-Fallen hier ergänzen. */
const PRONOUNCE = { 'Py': 'Pü' };
const OUT = 'public/assets/voice';

/* ---------- API-Key aus .env oder Umgebung ---------- */
const env = {};
if (existsSync('.env')) readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/); if (m) env[m[1]] = m[2];
});
const KEY = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
if (!KEY || KEY.includes('hier-deinen')) {
  console.error('✗ Kein API-Key. Bitte ELEVENLABS_API_KEY in .env eintragen.');
  process.exit(1);
}

/* ---------- --list: verfügbare Stimmen anzeigen ---------- */
if (process.argv.includes('--list')) {
  const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } });
  const d = await r.json();
  d.voices.forEach(v => console.log(`${v.voice_id}  ${v.name}  (${(v.labels && Object.values(v.labels).join(', ')) || ''})`));
  process.exit(0);
}

/* ---------- Alle festen Story-Zeilen einsammeln ---------- */
const lines = [];
const add = (voice, text, ctx) => {
  if (!lines.some(l => l.voice === voice && l.text === text)) lines.push({ voice, text, ctx });
};
INTRO.forEach(s => add(s.voice, s.text));
for (let f = 1; f <= 6; f++) bossIntroScene(f).forEach(s => add(s.voice, s.text));
BOSS_DEFEAT.forEach(t => add('boss', t));
BOSS_RAGE.forEach(t => add('boss', t));
companionJoinScene({ icon: '', name: '' }).forEach(s => add(s.voice, s.text));
COMPANION_CHEER.forEach(t => add('companion', t));
FLOOR_QUOTES.forEach(t => add('companion', t));
add('narrator', FLOOR_DONE);
add('narrator', FLOOR_DONE_ALL);
/* Audio-First-UI-Zeilen: shieldAlert spricht die Lehrer-Stimme, Rest Erzähler */
add('word', UI_LINES.shieldAlert);
['welcomeBack', 'welcomeNew', 'dead', 'rotate'].forEach(k => add('narrator', UI_LINES[k]));

/* ---------- Gameplay: Wörter, Silben, Schildwörter, Sätze ----------
   Quelle ist words.json → tauscht die Therapeutin Wörter aus, erzeugt
   der nächste Lauf automatisch die fehlenden Clips. */
const WORDS = JSON.parse(readFileSync('src/learning/words.json', 'utf8'));
/* Standard-Stufen + alle Wortschatz-Pakete (Klasse 1/2, 3/4, …) */
const allTierWords = [
  ...Object.values(WORDS.tiers).flat(),
  ...Object.values(WORDS.packs || {}).flatMap(p => Object.values(p.tiers).flat())
];
allTierWords.forEach(w => {
  add('word', w.w);                  // das Wort allein (Scaffolding-Stufe 1)
  add('word', zauberePhrase(w.w));   // „Zaubere: …" (Aufgaben-Start)
  add('word', syllableRead(w));      // „O, ma. Oma" (📯-Button)
  /* Silben mit previous_text/next_text aus ihrem Wort konditionieren:
     „Schlan" + next_text „ge" klingt wie der Anfang von „Schlange" –
     ohne Kontext rät das Modell die Aussprache von Fragmenten */
  w.s.forEach((syl, i) => add('word', syl, {
    prev: w.s.slice(0, i).join(''),
    next: w.s.slice(i + 1).join('')
  }));
});
WORDS.shields.forEach(s => { add('word', s.w); add('word', shieldWas(s.w)); });
COLORS.forEach(c => {
  add('word', befehlHelp(c.name));
  BEFEHL_VERBS.forEach(v => add('word', befehlOne(v, c.name)));
});
COLORS.forEach(a => COLORS.forEach(b => {
  if (a.name !== b.name) add('word', befehlTwo(a.name, b.name));
}));
FIXED_GAMEPLAY.forEach(t => add('word', t));

/* ---------- Generieren (inkrementell: vorhandene Clips bleiben) ---------- */
mkdirSync(OUT, { recursive: true });
const manifest = existsSync(`${OUT}/manifest.json`)
  ? JSON.parse(readFileSync(`${OUT}/manifest.json`, 'utf8')) : {};
let made = 0, skipped = 0;

for (const { voice, text, ctx } of lines) {
  /* Voice-ID im Hash: Stimme in VOICE_IDS tauschen → Clips regenerieren automatisch.
     Kontext im Hash: geänderte Konditionierung regeneriert die Silbe */
  const speak = (voice === 'word' && PRONOUNCE[text]) || text;
  const ctxKey = (ctx ? '|' + (ctx.prev || '') + '|' + (ctx.next || '') : '') +
    (speak !== text ? '|p:' + speak : '');
  const id = createHash('md5').update(VOICE_IDS[voice] + '|' + text + ctxKey).digest('hex').slice(0, 10);
  const file = `${voice}-${id}.mp3`;
  const key = voice + '|' + text;
  if (manifest[key] === file && existsSync(`${OUT}/${file}`)) { skipped++; continue; }

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_IDS[voice]}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: speak, model_id: MODEL,
      ...(ctx && ctx.prev ? { previous_text: ctx.prev } : {}),
      ...(ctx && ctx.next ? { next_text: ctx.next } : {}),
      voice_settings: { stability: .5, similarity_boost: .75, style: voice === 'boss' ? .35 : .2 }
    })
  });
  if (!r.ok) {
    console.error(`✗ ${voice}: "${text.slice(0, 40)}…" → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    continue;
  }
  writeFileSync(`${OUT}/${file}`, Buffer.from(await r.arrayBuffer()));
  manifest[key] = file;
  made++;
  console.log(`✓ [${voice}] ${text.slice(0, 60)}`);
}
/* Manifest-Einträge entfernen, deren Zeile es nicht mehr gibt,
   und verwaiste MP3s löschen (z.B. nach Stimmen-/Text-Änderungen) */
const valid = new Set(lines.map(l => l.voice + '|' + l.text));
Object.keys(manifest).forEach(k => { if (!valid.has(k)) delete manifest[k]; });
const used = new Set(Object.values(manifest));
let removed = 0;
readdirSync(OUT).filter(f => f.endsWith('.mp3') && !used.has(f))
  .forEach(f => { unlinkSync(`${OUT}/${f}`); removed++; });

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
console.log(`\nFertig: ${made} neu generiert, ${skipped} unverändert, ${removed} verwaiste gelöscht, Manifest: ${Object.keys(manifest).length} Einträge.`);
