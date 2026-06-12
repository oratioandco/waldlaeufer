/* =====================================================================
   STORY-INHALTE – Rahmenhandlung, Wächter-Persönlichkeiten, Begleiter
   Alles wird VORGELESEN (TTS); Text ist optional einblendbar
   (freiwilliges Zusatzlesen, nie Pflicht-Lesehürde). Gewaltarm:
   Schatten werden gebrochen, Tiere und Wächter werden BEFREIT.
   ===================================================================== */
import { BOSSES } from '../creatures/data.js';

export const VOICES = {
  narrator:  { rate: .95,  pitch: .9 },
  boss:      { rate: .85,  pitch: .55 },
  companion: { rate: 1.03, pitch: 1.25 }
};

export const INTRO = [
  { icon: '👑', name: 'DER SCHWARZE KÖNIG', voice: 'boss',
    text: 'Dieser Wald gehört jetzt mir! Meine Schattengeister halten alle Tiere gefangen.' },
  { icon: '🌲', name: 'ERZÄHLER', voice: 'narrator',
    text: 'Nur du kannst sie retten, Waldläufer. Deine Zauberwörter brechen jeden Schatten.' },
  { icon: '🪄', name: 'ERZÄHLER', voice: 'narrator',
    text: 'Folge dem Pfad, befreie die Tiere – und erlöse die sechs Wächter des Waldes!' }
];

/* Die verdorbenen Wächter stellen sich vor – jeder mit eigenem Charakter */
const BOSS_INTRO = [
  'Grrrr… Ich bin der Schatten-Wolf. Dieser Pfad ist mein Revier!',
  'Wer stört meinen Schlaf? Ich bin die Schatten-Bärin – und ich bin sehr, sehr grimmig!',
  'Schlau bist du, Waldläufer. Aber ich bin der Schatten-Fuchs – und ich bin schlauer!',
  'Ich bin der Schatten-Adler. Von hier oben sehe ich jeden deiner Fehler!',
  'Ich bin der Schatten-Hirsch, Wächter des stillen Waldes. Zeig mir, was deine Wörter können.',
  'Du bist weit gekommen, Waldläufer. Doch ich bin der Schwarze König – an mir zerbricht deine Magie!'
];
/* Phase 2 (ab halber Kraft): der Schatten bäumt sich auf */
export const BOSS_RAGE = [
  'Grrrrr! Jetzt zeige ich dir meine Zähne!',
  'Du weckst meinen ganzen Zorn, kleiner Läufer!',
  'Genug gespielt! Jetzt wird der Fuchs ernst!',
  'Spürst du den Sturm? Meine Schwingen tragen Schatten!',
  'Der stille Wald wird dunkel, Waldläufer!',
  'Du zwingst mich, meine ganze Macht zu entfesseln!'
];
/* Befreiungs-Momente: der Schatten fällt, der wahre Wächter kommt zurück */
export const BOSS_DEFEAT = [
  'Auuuuu! Der Schatten ist fort… Danke, Waldläufer. Lauf weiter – ich bewache den Pfad!',
  'Brumm… Ich bin wieder ich! Hab Dank, kleiner Held.',
  'Schlau gespielt! Der Schatten ist fort – und der Fuchs ist frei.',
  'Meine Augen sehen wieder klar! Flieg weiter, mutiger Waldläufer.',
  'Der stille Wald dankt dir. Mein Geweih trägt wieder Licht.',
  'Was… was habe ich getan? Der Schatten hatte auch mich gepackt… Verzeih mir, Waldläufer. Du hast uns alle gerettet!'
];
export function bossIntroScene(floor) {
  const i = Math.min(floor - 1, BOSSES.length - 1);
  return [{ icon: BOSSES[i].sym, name: BOSSES[i].name, voice: 'boss', text: BOSS_INTRO[i] }];
}

export function companionJoinScene(c) {
  return [
    { icon: c.icon, name: c.name, voice: 'companion',
      text: 'Danke, Waldläufer! Du hast mich vom Schatten befreit.' },
    { icon: c.icon, name: c.name, voice: 'companion',
      text: 'Ich begleite dich! Gemeinsam befreien wir die anderen Tiere.' }
  ];
}
export const COMPANION_CHEER = [
  'Super gezaubert!',
  'Wieder ein Tier frei!',
  'Spürst du das? Der Wald wird heller!',
  'Weiter so, Waldläufer!',
  'Deine Wortmagie wird immer stärker!'
];
export const FLOOR_DONE = 'Gebiet geschafft! Ein Wächter des Waldes ist wieder frei.';
/* nach Gebiet 6: alle Wächter frei → Überleitung in Runde 2 */
export const FLOOR_DONE_ALL = 'Alle Wächter sind frei – der ganze Wald jubelt! Doch kleine Schattenreste verstecken sich noch. Die Jagd geht weiter, Waldläufer!';
/* Audio-First: kindgerichtete UI-Momente, die sonst Lese-Hürden wären */
export const UI_LINES = {
  welcomeBack: 'Willkommen zurück, Waldläufer! Tippe auf deinen Namen.',
  welcomeNew: 'Willkommen im großen Wald! Schreib deinen Namen – dann geht es los.',
  dead: 'Oh nein, umgehauen! Aber ein Waldläufer gibt niemals auf. Tippe auf den Blitz und steh wieder auf!',
  rotate: 'Dreh dein Tablet quer – dann siehst du den ganzen Wald!',
  shieldAlert: 'Achtung! Merk dir das Schildwort.'
};
export const FLOOR_QUOTES = [
  'Ein Wächter ist zurück! Der Wald atmet auf.',
  'Die Schattengeister werden nervös – weiter so!',
  'Hörst du die Vögel? Sie singen wieder.',
  'Der Schwarze König verliert seine Macht!',
  'Bald ist der ganze Wald wieder frei!',
  'Du hast es fast geschafft, Waldläufer!'
];
