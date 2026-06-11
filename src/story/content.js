/* =====================================================================
   STORY-INHALTE – Rahmenhandlung, Boss-Persönlichkeiten, Begleiter
   Alles wird VORGELESEN (TTS); Text ist optional einblendbar
   (freiwilliges Zusatzlesen, nie Pflicht-Lesehürde). Gewaltarm:
   Schatten „zerfallen", Tiere werden befreit.
   ===================================================================== */
import { BOSSES } from '../creatures/data.js';

export const VOICES = {
  narrator:  { rate: .95,  pitch: .9 },
  boss:      { rate: .85,  pitch: .55 },
  companion: { rate: 1.03, pitch: 1.25 }
};

export const INTRO = [
  { icon: '👑', name: 'DER SCHWARZE KÖNIG', voice: 'boss',
    text: 'Dieser Wald gehört jetzt mir! Alle Tiere stehen unter meinem Schatten-Zauber.' },
  { icon: '🌲', name: 'ERZÄHLER', voice: 'narrator',
    text: 'Der Schwarze König hat die Tiere des großen Waldes verzaubert. Nur ein Waldläufer mit Wortmagie kann sie befreien.' },
  { icon: '🪄', name: 'ERZÄHLER', voice: 'narrator',
    text: 'Folge dem Pfad, sprich die Zauberwörter – und hol dir alle Schachfiguren zurück!' }
];

const BOSS_INTRO = [
  'Halt! Ich bin der Schatten-Bauer. Hier kommst du nicht vorbei!',
  'Hihi! Ich bin der Schatten-Springer. Ich hüpfe schneller, als du zaubern kannst!',
  'Ich bin der Schatten-Läufer. Deine kleinen Wörter schrecken mich nicht.',
  'Ich bin der Schatten-Turm! Meine Mauern wackeln nicht.',
  'Ich bin die Schatten-Dame. Zeig mir deine Magie, kleiner Waldläufer.',
  'Du bist weit gekommen, Waldläufer. Doch hier endet dein Weg.'
];
export const BOSS_DEFEAT = [
  'Ohh… mein Schatten… zerfällt…!',
  'Nicht fair! Du zauberst zu gut!',
  'Unmöglich… deine Wörter sind zu stark…',
  'Meine… Mauern…!',
  'Welch starke Magie… ich verneige mich.',
  'Der Wald… gehört wieder… euch…'
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
export const FLOOR_QUOTES = [
  'Ein Gebiet ist frei! Der Wald atmet auf.',
  'Die Schattenfiguren werden nervös – weiter so!',
  'Hörst du die Vögel? Sie singen wieder.',
  'Der Schwarze König verliert seine Macht!',
  'Bald ist der ganze Wald wieder frei!',
  'Du hast es fast geschafft, Waldläufer!'
];
