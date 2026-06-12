/* =====================================================================
   SPEICHERSTAND – lokale Spieler-Profile (localStorage, kein Account)
   Jedes Kind hat ein eigenes Profil mit eigenem Leitner-Lernstand.
   Bewusst ohne Backend: Lerndaten eines Kindes bleiben auf dem Gerät.
   ===================================================================== */
import { G } from '../state.js';
import { serializeLearning, restoreLearning, SESSION } from '../learning/engine.js';

const KEY = 'waldlaeufer.save.v1';

function readStore() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { profiles: {}, activeId: null }; }
  catch (e) { return { profiles: {}, activeId: null }; }
}
function writeStore(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}

export function listProfiles() {
  const s = readStore();
  return Object.entries(s.profiles)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => b.updated - a.updated);
}
/* Schutz: Erst wenn in DIESER Sitzung ein Profil gestartet wurde, darf
   gespeichert werden. Sonst überschreibt z.B. der pagehide-Handler auf
   dem Startbildschirm das Profil mit dem Default-Spielzustand. */
let sessionStarted = false;

export function createProfile(name) {
  const s = readStore();
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  s.profiles[id] = { name, updated: Date.now(), data: null };
  s.activeId = id;
  writeStore(s);
  sessionStarted = true;
  return id;
}
export function selectProfile(id) {
  const s = readStore();
  if (!s.profiles[id]) return;
  s.activeId = id;
  writeStore(s);
  if (s.profiles[id].data) restoreAll(s.profiles[id].data);
  sessionStarted = true;
}
/* Session-Historie: ein Eintrag pro Spielsitzung, fortgeschrieben
   bei jedem Speichern (fürs Eltern-/Therapeuten-Panel) */
let sessionStamp = null;

export function saveActive() {
  if (!sessionStarted) return;
  const s = readStore();
  const id = s.activeId;
  if (!id || !s.profiles[id]) return;
  const data = collectAll();
  data.history = (s.profiles[id].data && s.profiles[id].data.history) || [];
  if (SESSION.words > 0) {
    if (!sessionStamp) { sessionStamp = Date.now(); data.history.push({ t: sessionStamp, w: 0, c: 0 }); }
    const entry = data.history.find(h => h.t === sessionStamp);
    if (entry) { entry.w = SESSION.words; entry.c = SESSION.clean; }
    if (data.history.length > 30) data.history = data.history.slice(-30);
  }
  s.profiles[id].data = data;
  s.profiles[id].updated = Date.now();
  writeStore(s);
}
export function getHistory() {
  const s = readStore();
  const p = s.profiles[s.activeId];
  return (p && p.data && p.data.history) || [];
}

/* ---------- Export/Import als Datei (Gerätewechsel, kein Account) ---------- */
export function exportActiveProfile() {
  if (sessionStarted) saveActive(); /* aktuellen Stand mitnehmen */
  const s = readStore();
  const p = s.profiles[s.activeId];
  if (!p) return null;
  return { format: 'waldlaeufer-profile', v: 1, name: p.name, data: p.data };
}
export function importProfile(obj) {
  if (!obj || obj.format !== 'waldlaeufer-profile' || !obj.name) {
    throw new Error('Das ist kein Waldläufer-Spielstand.');
  }
  const s = readStore();
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  s.profiles[id] = {
    name: String(obj.name).toUpperCase().slice(0, 12),
    updated: Date.now(),
    data: obj.data || null
  };
  writeStore(s);
  return id;
}

function collectAll() {
  return {
    floor: G.floor, gems: G.gems, trophies: G.trophies, kills: G.kills,
    companion: G.companion, seenIntro: G.seenIntro,
    freedSpecies: G.freedSpecies,
    learning: serializeLearning()
  };
}
function restoreAll(d) {
  G.floor = d.floor || 1;
  G.gems = d.gems || 0;
  G.trophies = d.trophies || [];
  G.kills = d.kills || 0;
  G.companion = d.companion || null;
  G.seenIntro = !!d.seenIntro;
  G.freedSpecies = d.freedSpecies || {};
  restoreLearning(d.learning);
}
