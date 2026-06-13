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
  'Ein Bach! Zaubere das Wort, dann wächst die Brücke.',
  'Die Brücke wächst!',
  'Eine Truhe! Merk dir das Schlüsselwort.',
  'Richtig! Die Truhe öffnet sich.',
  'Richtig! Du hast den Angriff abgewehrt.',
  'Richtig! Die Blumen stärken deine Wortmagie.'
];

/* ---------- Lager: Begleiter-Tausch (Begleiter-Stimme) ---------- */
export const CAMP_SWAP = 'Juhu, ich komme mit dir!';

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
