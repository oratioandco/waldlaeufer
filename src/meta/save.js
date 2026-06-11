/* =====================================================================
   SPEICHERSTAND – lokale Spieler-Profile (localStorage, kein Account)
   Jedes Kind hat ein eigenes Profil mit eigenem Leitner-Lernstand.
   Bewusst ohne Backend: Lerndaten eines Kindes bleiben auf dem Gerät.
   ===================================================================== */
import { G } from '../state.js';
import { serializeLearning, restoreLearning } from '../learning/engine.js';

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
export function createProfile(name) {
  const s = readStore();
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  s.profiles[id] = { name, updated: Date.now(), data: null };
  s.activeId = id;
  writeStore(s);
  return id;
}
export function selectProfile(id) {
  const s = readStore();
  if (!s.profiles[id]) return;
  s.activeId = id;
  writeStore(s);
  if (s.profiles[id].data) restoreAll(s.profiles[id].data);
}
export function saveActive() {
  const s = readStore();
  const id = s.activeId;
  if (!id || !s.profiles[id]) return;
  s.profiles[id].data = collectAll();
  s.profiles[id].updated = Date.now();
  writeStore(s);
}

function collectAll() {
  return {
    floor: G.floor, gems: G.gems, trophies: G.trophies, kills: G.kills,
    learning: serializeLearning()
  };
}
function restoreAll(d) {
  G.floor = d.floor || 1;
  G.gems = d.gems || 0;
  G.trophies = d.trophies || [];
  G.kills = d.kills || 0;
  restoreLearning(d.learning);
}
