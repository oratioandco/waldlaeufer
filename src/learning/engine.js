/* =====================================================================
   LERN-ENGINE  (Wortauswahl ist Therapie-Logik, kein Zufall)
   Leitner-Spaced-Repetition + Mastery-Gating.
   Stufen nach lautgetreuer Progression; innerhalb der Stufe nach
   Einführungsreihenfolge. Wortlisten in words.json (austauschbar!).
   ===================================================================== */
import WORDS from './words.json';

export const TIER_WORDS = WORDS.tiers;
export const TIER_NAMES = WORDS.tierNames;
const SHIELDS_BASE = WORDS.shields;

/* Wortzustand: box 0=neu … 4=sicher */
export const LEX = {};
Object.entries(TIER_WORDS).forEach(([t, list]) => {
  list.forEach((w, order) => { LEX[w.w] = { ...w, tier: +t, order, box: 0, seen: 0, errs: 0 }; });
});
export let activeTier = 1;
let wordCounter = 0, reviewQueue = [], lastWord = '';
export const SESSION = { words: 0, clean: 0 };

export function tierMastery(t) {
  const list = TIER_WORDS[t];
  const ok = list.filter(w => LEX[w.w].box >= 2).length;
  return ok / list.length;
}
function maybeUnlock() {
  while (activeTier < 4 && tierMastery(activeTier) >= .7) activeTier++;
}
export function nextWord() {
  wordCounter++;
  maybeUnlock();
  /* 1) Fällige Fehler-Wiederholungen zuerst (verteiltes Wiederholen) */
  for (let i = 0; i < reviewQueue.length; i++) {
    const r = reviewQueue[i];
    if (r.at <= wordCounter && r.w !== lastWord) {
      reviewQueue.splice(i, 1);
      lastWord = r.w; return LEX[r.w];
    }
  }
  /* 2) 20% Festigung: gemeisterte Wörter niedrigerer Stufen flüssig halten */
  if (activeTier > 1 && Math.random() < .2) {
    const pool = [];
    for (let t = 1; t < activeTier; t++) TIER_WORDS[t].forEach(w => {
      if (LEX[w.w].box >= 2 && w.w !== lastWord) pool.push(LEX[w.w]); });
    if (pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      lastWord = pick.w; return pick;
    }
  }
  /* 3) Aktive Stufe: niedrigste Box zuerst, dann Einführungsreihenfolge */
  const cand = TIER_WORDS[activeTier].map(w => LEX[w.w])
    .filter(s => s.w !== lastWord)
    .sort((a, b) => (a.box - b.box) || (a.seen - b.seen) || (a.order - b.order));
  const pick = cand[0] || LEX[TIER_WORDS[activeTier][0].w];
  lastWord = pick.w; return pick;
}
export function reportWord(w, errorFree) {
  const s = LEX[w]; if (!s) return;
  s.seen++; SESSION.words++;
  if (errorFree) { s.box = Math.min(4, s.box + 1); SESSION.clean++; }
  else {
    s.errs++; s.box = Math.max(0, s.box - 1);
    /* gezielte Wiedervorlage nach 2–3 ANDEREN Wörtern (verteiltes
       Wiederholen): +3/+4 → es liegen wirklich 2–3 Wörter dazwischen */
    reviewQueue.push({ w, at: wordCounter + 3 + Math.floor(Math.random() * 2) });
  }
}

/* ---------- Persistenz (tolerant gegen geänderte Wortlisten:
   Wörter werden über den Wortlaut gematcht, Unbekanntes ignoriert) ---------- */
export function serializeLearning() {
  const words = {};
  Object.values(LEX).forEach(s => { words[s.w] = { b: s.box, n: s.seen, e: s.errs }; });
  const shields = {};
  Object.entries(shieldStats).forEach(([w, v]) => shields[w] = v.fails);
  return { tier: activeTier, words, shields };
}
export function restoreLearning(d) {
  if (!d) return;
  Object.entries(d.words || {}).forEach(([w, v]) => {
    if (LEX[w]) { LEX[w].box = v.b || 0; LEX[w].seen = v.n || 0; LEX[w].errs = v.e || 0; }
  });
  Object.entries(d.shields || {}).forEach(([w, f]) => {
    if (shieldStats[w]) shieldStats[w].fails = f || 0;
  });
  activeTier = Math.min(4, Math.max(1, d.tier || 1));
}

/* Schildwörter (häufigste Funktionswörter), durchmischt ohne Direkt-Wiederholung */
let shieldDeck = [];
export const shieldStats = {};
SHIELDS_BASE.forEach(s => shieldStats[s.w] = { fails: 0 });
export function nextShield() {
  if (!shieldDeck.length) {
    shieldDeck = [...SHIELDS_BASE].sort(() => Math.random() - .5);
    /* Fehlerwörter doppelt ins Deck */
    SHIELDS_BASE.forEach(s => { if (shieldStats[s.w].fails > 0) shieldDeck.push(s); });
  }
  return shieldDeck.pop();
}
