/* =====================================================================
   KOSMETIK & TAUSCHPLATZ (Roadmap 6 – Meta-Progression)
   Kristalle ausgeben: Zauber-Farben, Kartenrahmen, Begleiter-Auren.
   REIN kosmetisch – niemals Einfluss auf die Lern-Engine (kein
   Pay-to-Win gegen Mastery-Gating). Stand wird pro Profil gespeichert.
   ===================================================================== */
import { G } from '../state.js';

export const SHOP_ITEMS = [
  /* Zauber-Farben (Orb, Schweif, Treffer-Funken) */
  { id: 'spell_gold',    kind: 'spell', icon: '✨', name: 'Gold-Zauber',    price: 25,
    fx: { orb: 0xfff3c0, glow: 0xffd34a, burst: [0xfff3c0, 0xffd34a, 0xffffff, 0xffb060] } },
  { id: 'spell_eis',     kind: 'spell', icon: '❄️', name: 'Eis-Zauber',     price: 25,
    fx: { orb: 0xeaf8ff, glow: 0x7fd4ff, burst: [0xeaf8ff, 0x7fd4ff, 0xffffff, 0xb8e6ff] } },
  { id: 'spell_rosa',    kind: 'spell', icon: '🌸', name: 'Blüten-Zauber',  price: 25,
    fx: { orb: 0xffeaf4, glow: 0xff9ad4, burst: [0xffeaf4, 0xff9ad4, 0xffffff, 0xffc7e3] } },
  { id: 'spell_nacht',   kind: 'spell', icon: '🔮', name: 'Nacht-Zauber',   price: 35,
    fx: { orb: 0xf0eaff, glow: 0xb78aff, burst: [0xf0eaff, 0xb78aff, 0xffffff, 0x9b59c9] } },
  /* Begleiter-Auren (Glühen um das Begleiter-Tier) */
  { id: 'aura_sonne',    kind: 'aura', icon: '🌞', name: 'Sonnen-Aura',     price: 40, fx: { color: 0xffd9a0 } },
  { id: 'aura_mond',     kind: 'aura', icon: '🌙', name: 'Mond-Aura',       price: 40, fx: { color: 0xaac8ff } },
  /* Kartenrahmen (nur der Rand – Lesefläche bleibt unangetastet!) */
  { id: 'cards_gold',    kind: 'cards', icon: '🏅', name: 'Gold-Rahmen',    price: 60, fx: { frame: '#c9a227' } },
  { id: 'cards_blueten', kind: 'cards', icon: '🌷', name: 'Blüten-Rahmen',  price: 60, fx: { frame: '#d4779a' } }
];
export function shopItem(id) { return SHOP_ITEMS.find(i => i.id === id); }

function cos() {
  if (!G.cosmetics) G.cosmetics = { owned: [], spell: null, aura: null, cards: null };
  return G.cosmetics;
}
export function isOwned(id) { return cos().owned.includes(id); }
export function isEquipped(id) {
  const it = shopItem(id);
  return !!it && cos()[it.kind] === id;
}
/* Kauf: zieht Kristalle ab und legt das Stück direkt an */
export function buyItem(id) {
  const it = shopItem(id);
  if (!it || isOwned(id)) return false;
  if (G.gems < it.price) return false;
  G.gems -= it.price;
  cos().owned.push(id);
  cos()[it.kind] = id;
  return true;
}
/* Anlegen/Ablegen (Tipp auf besessenes Stück wechselt) */
export function toggleEquip(id) {
  const it = shopItem(id);
  if (!it || !isOwned(id)) return false;
  cos()[it.kind] = isEquipped(id) ? null : id;
  return true;
}

/* ---------- Anwendung im Spiel (Standard, wenn nichts angelegt) ---------- */
const SPELL_DEFAULT = { orb: 0xeafff2, glow: 0x46d68a, burst: [0xb6f7c2, 0x46d68a, 0xffffff, 0xffd34a] };
export function spellFx() {
  const it = shopItem(cos().spell);
  return it ? it.fx : SPELL_DEFAULT;
}
export function cardFrame() {
  const it = shopItem(cos().cards);
  return it ? it.fx.frame : '#a4774a';
}
export function auraColor() {
  const it = shopItem(cos().aura);
  return it ? it.fx.color : null;
}
