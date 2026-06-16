/* =====================================================================
   GAMEPLAY-SPRACHZEILEN – EINE Quelle für Laufzeit UND Stimmen-Generator
   (scripts/generate-voices.mjs). Jede hier erzeugte Zeichenkette ist
   zugleich der Manifest-Schlüssel des gebackenen Audio-Clips.
   Keine Abhängigkeiten außer Daten → in Node importierbar.
   ===================================================================== */
export const BEFEHL_VERBS = ['Tippe', 'Berühre', 'Wähle'];

export const zauberePhrase = w => 'Zaubere: ' + w;
/* Silbenweises Vorlesen (📯-Button): „O, ma. Oma" */
export const syllableRead = word => word.s.join(', ') + '. ' + word.w;
export const shieldWas = w => 'Das Wort war: ' + w;

export const befehlOne = (verb, color) =>
  `${verb} die ${color} Blume` + (verb === 'Tippe' ? ' an' : '');
export const befehlTwo = (a, b) =>
  `Tippe zuerst die ${a} und dann die ${b} Blume an`;
export const befehlHelp = color => `Such die ${color} Blume.`;

export const FIXED_GAMEPLAY = [
  'Ein Bach! Zaubere das Wort, dann entsteht eine Brücke.',
  'Die Brücke steht!',
  'Eine Truhe! Merk dir das Schlüsselwort.',
  'Richtig! Die Truhe öffnet sich.',
  'Richtig! Du hast den Angriff abgewehrt.',
  'Richtig! Die Blumen stärken deine Wortmagie.'
];

/* ---------- Lager: Begleiter-Tausch (Begleiter-Stimme) ---------- */
export const CAMP_SWAP = 'Juhu, ich komme mit dir!';

/* ---------- Lese-Rang-Aufstieg (Erzähler) ---------- */
export const RANK_UP = 'Glückwunsch! Du bist im Lesen aufgestiegen.';

/* ---------- Schatten-Hieb des Bosses (externalisiert: DER BOSS greift an,
   nicht 'du hast falsch gelesen') ---------- */
export const BOSS_HIT = 'Mein Schatten trifft dich!';

/* ---------- Lagerfeuer-Erholung (erklärt das Herzen-Auffüllen) ---------- */
export const CAMP_REST = 'Am Lagerfeuer erholst du dich. Deine Herzen sind wieder voll.';

/* ---------- Glühwürmchen-Jagd (reines Belohnungsspiel, Erzähler) ---------- */
export const FIREFLY_LINES = [
  'Glühwürmchen-Jagd! Tipp so viele wie du kannst, schnell hintereinander für mehr Punkte!',
  'Wahnsinn, was für eine Jagd!',
  'Toll gefangen!'
];

/* ---------- Schatzkarte (Lese-Minispiel: Sinnentnahme) ---------- */
export const TREASURE_INTRO = 'Schatzkarte! Lies, wohin du gehen sollst, und tippe den richtigen Ort an.';
export const TREASURE_WIN = 'Der Schatz! Toll gelesen und den Weg gefunden!';
export const TREASURE_CLUES = [
  'Geh zum roten Pilz.',
  'Geh zur gelben Blume.',
  'Geh zur grünen Tanne.',
  'Geh zum grauen Stein.',
  'Geh zum blauen Kristall.',
  'Geh zum braunen Stamm.'
];

/* ---------- Pilz-Hüpfer (reines Belohnungsspiel, Erzähler) ---------- */
export const HOPPER_LINES = [
  'Pilz-Hüpfer! Tipp im richtigen Moment, wenn ein Pilz in der Mitte ist – je genauer, desto mehr Punkte!',
  'Was für eine Hüpf-Kette!',
  'Toll gehüpft!'
];

/* ---------- Wort-Bogenschießen (Erzähler-Zeilen) ---------- */
export const ARCHERY_LINES = [
  'Bogenschießen! Streich nach unten zum Spannen, ziel nach links und rechts und lass los.',
  'Triff das Wort:',
  'Spann den Bogen weiter!',
  'Daneben – probier es nochmal!',
  'Das war ein anderes Wort. Triff:',
  'Bullseye!',
  'Getroffen!',
  'Scharf geschossen! Toll gezielt.'
];

/* ---------- Silben-Angeln (Erzähler-Zeilen; Wort/Silben kommen aus dem Pool) ---------- */
export const FISHING_LINES = [
  'Silben-Angeln! Tipp die Silben in der richtigen Reihenfolge an.',
  'Angle das Wort:',
  'Volltreffer!',
  'Toll geangelt! Deine Silben sitzen.'
];

/* ---------- Tauschplatz (Audio-First: jedes Stück wird vorgelesen) ---------- */
export const shopItemLine = (name, price) => `${name}. Kostet ${price} Kristalle.`;
export const SHOP_FIXED = [
  'Willkommen am Tauschplatz! Tipp etwas an, ich sage dir, was es kostet.',
  'Tipp noch einmal, dann tauschen wir!',
  'Getauscht! Das steht dir gut.',
  'Angelegt!',
  'Abgelegt. Der Wald-Look ist auch schön!',
  'Dafür brauchst du noch ein paar Kristalle mehr. Sammle weiter!'
];
