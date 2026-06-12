/* ---------- Zentraler Spielzustand ---------- */
export const G = {
  floor: 1, hearts: 5, gems: 0, combo: 0, buff: 0, trophies: [], kills: 0,
  word: null, idx: 0, errors: 0, busy: true, mode: null,
  mob: null, recentErr: [],
  stations: [], stIdx: -1, state: 'idle',
  befehlSeq: [], befehlPos: 0, befehlSentence: '',
  companion: null, seenIntro: false,
  freedSpecies: {} /* Tierart → Anzahl befreit (fürs Lager) */
};
