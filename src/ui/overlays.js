/* ---------- Overlays: Pause, Einstellungen, Gebiet geschafft,
   Eltern-Panel mit Live-Lern-Report ---------- */
import { G } from '../state.js';
import { SESSION, activeTier, tierMastery, TIER_NAMES, getCustomWords, setCustomWords } from '../learning/engine.js';
import { getHistory, exportActiveProfile, importProfile } from '../meta/save.js';
import WORDS from '../learning/words.json';
import { SHOP_ITEMS, isOwned, isEquipped, buyItem, toggleEquip } from '../meta/cosmetics.js';
import { shopItemLine, SHOP_FIXED } from '../learning/speech-lines.js';
import { renderHUD } from './hud.js';
import { BOSSES } from '../creatures/data.js';
import { planFloor, advance } from '../world/stations.js';
import { biomeFor } from '../world/biomes.js';
import { enterCamp, leaveCamp } from '../world/camp.js';
import { startFishing } from '../challenges/fishing.js';
import { startArchery } from '../challenges/archery.js';
import { renderHearts } from './hud.js';
import { announce } from './feedback.js';
import { setVoiceOn, setVoiceVol, getVoiceVol, sayStorySeq } from '../audio/tts.js';
import { sndWin, setSfxVol, getSfxVol, sndGem, sndTap } from '../audio/sfx.js';
import { setMusicVol, getMusicVol, playLevelMusic } from '../audio/music.js';
import { refreshAmbience } from '../audio/ambience.js';
import { setQuality, setRES } from '../engine/quality.js';
import { saveActive } from '../meta/save.js';
import { FLOOR_QUOTES, FLOOR_DONE, FLOOR_DONE_ALL } from '../story/content.js';

export function ovOn(id) { document.getElementById(id).classList.add('on'); }
export function ovOff(id) { document.getElementById(id).classList.remove('on'); }

export function openPause() {
  document.getElementById('pauseStats').innerHTML = `
    <div class="stat"><div class="n">${G.gems}</div><div class="l">💎 KRISTALLE</div></div>
    <div class="stat"><div class="n">${G.kills}</div><div class="l">TIERE BEFREIT</div></div>
    <div class="stat"><div class="n">${G.trophies.length}</div><div class="l">WÄCHTER</div></div>`;
  ovOn('pauseOv');
}
export function openAdult() {
  const quote = SESSION.words ? Math.round(SESSION.clean / SESSION.words * 100) : 0;
  document.getElementById('reportStats').innerHTML =
    `<p style="margin:4px 0 10px">Wörter geübt: <b style="color:#9fe86f">${SESSION.words}</b>
     &nbsp;·&nbsp; davon fehlerfrei: <b style="color:#9fe86f">${quote}%</b>
     &nbsp;·&nbsp; aktive Stufe: <b style="color:#9fe86f">${activeTier}</b></p>`;
  document.getElementById('reportBars').innerHTML = [1, 2, 3, 4].map(t => {
    const m = Math.round(tierMastery(t) * 100);
    return `<div class="mbarWrap"><span>${TIER_NAMES[t]}</span>
      <div class="mbar"><div style="width:${m}%"></div></div><b>${m}%</b></div>`;
  }).join('');
  /* Sitzungs-Historie (über Sitzungen hinweg, fürs Therapie-Gespräch) */
  const hist = getHistory().slice(-8).reverse();
  document.getElementById('histList').innerHTML = hist.length
    ? hist.map(h => {
        const d = new Date(h.t);
        const q = h.w ? Math.round(h.c / h.w * 100) : 0;
        return `${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
          &nbsp;·&nbsp; <b>${h.w}</b> Wörter &nbsp;·&nbsp; <b>${q}%</b> fehlerfrei`;
      }).join('<br>')
    : 'Noch keine abgeschlossenen Sitzungen.';
  loadCustomWordsUI();
  /* Wortlisten gelten PRO PROFIL: auf dem Startbildschirm (kein Profil
     aktiv) wäre die Auswahl verloren – Bearbeitung erst im Spiel */
  const onTitle = document.getElementById('startOv').classList.contains('on');
  document.getElementById('packApply').disabled = onTitle;
  document.getElementById('cwSave').disabled = onTitle;
  const anyCustom = Object.values(getCustomWords()).some(l => l && l.length);
  document.getElementById('packStatus').textContent = onTitle
    ? 'Wortlisten gelten pro Profil – bitte zuerst das Abenteuer des Kindes starten.'
    : (anyCustom ? 'Eigene Wortlisten sind aktiv (siehe Förderwörter-Editor unten).' : '');
  ovOn('adultOv');
}

/* ---------- Wortschatz-Pakete (fertige Listen nach Lesestufe) ---------- */
function fillPackSelect() {
  const sel = document.getElementById('packSelect');
  Object.entries(WORDS.packs || {}).forEach(([key, p]) => {
    const o = document.createElement('option');
    o.value = key; o.textContent = p.name;
    sel.appendChild(o);
  });
}
function applyPackUI() {
  const key = document.getElementById('packSelect').value;
  const status = document.getElementById('packStatus');
  if (!key) {
    [1, 2, 3, 4].forEach(t => setCustomWords(t, []));
    status.textContent = '✓ Standard-Wörter (lautgetreue Progression) sind wieder aktiv.';
  } else {
    const pack = WORDS.packs[key];
    [1, 2, 3, 4].forEach(t => setCustomWords(t, pack.tiers[t] || []));
    status.textContent = `✓ „${pack.name}" ist jetzt aktiv – für alle vier Stufen.`;
  }
  saveActive();
  loadCustomWordsUI();
}

/* ---------- Spielstand als Datei sichern / einlesen ---------- */
function exportSaveUI() {
  const status = document.getElementById('saveStatus');
  const obj = exportActiveProfile();
  if (!obj) { status.textContent = 'Noch kein Profil gespielt – erst ein Abenteuer starten.'; return; }
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'waldlaeufer-' + obj.name.toLowerCase().replace(/[^a-zä-ü0-9]/gi, '') + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  status.textContent = `✓ Spielstand von ${obj.name} als Datei gesichert.`;
}
function importSaveUI(file) {
  const status = document.getElementById('saveStatus');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      importProfile(obj);
      status.textContent = `✓ Spielstand von ${obj.name} eingelesen – Spiel startet neu …`;
      setTimeout(() => location.reload(), 1600);
    } catch (e) {
      status.textContent = '✗ ' + (e.message || 'Datei konnte nicht gelesen werden.');
    }
  };
  reader.readAsText(file);
}

/* ---------- Förderwörter-Editor ---------- */
function loadCustomWordsUI() {
  const tier = +document.getElementById('cwTier').value;
  const words = getCustomWords()[tier] || [];
  document.getElementById('cwWords').value = words.map(w => w.s.join('-')).join('\n');
  document.getElementById('cwStatus').textContent = '';
}
function saveCustomWordsUI() {
  const tier = +document.getElementById('cwTier').value;
  const lines = document.getElementById('cwWords').value.split('\n')
    .map(l => l.trim()).filter(Boolean);
  const words = [];
  for (const line of lines) {
    const syl = line.split('-').map(s => s.trim()).filter(Boolean);
    if (!syl.length) continue;
    words.push({ w: syl.join(''), s: syl });
  }
  setCustomWords(tier, words);
  saveActive();
  document.getElementById('cwStatus').textContent = words.length
    ? `✓ ${words.length} Förderwörter für ${TIER_NAMES[tier]} gespeichert. Neue Wörter sprechen zunächst mit der Systemstimme.`
    : `✓ Stufe zurückgesetzt – Standard-Wörter sind wieder aktiv.`;
}
export function openSettings() { ovOn('setOv'); }

/* ---------- 💎 Tauschplatz (Audio-First: alles wird vorgelesen) ----------
   Erster Tipp auf ein neues Stück: Name + Preis werden gesprochen.
   Zweiter Tipp: tauschen. Besessene Stücke: Tipp legt an/ab.
   Rein kosmetisch – die Lern-Engine bleibt unberührt. */
let shopArmed = null;
function renderShop() {
  document.getElementById('shopGems').innerHTML = `Deine Kristalle: 💎 <b>${G.gems}</b>`;
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = '';
  SHOP_ITEMS.forEach(it => {
    const b = document.createElement('button');
    b.className = 'shopItem'
      + (isEquipped(it.id) ? ' equipped' : isOwned(it.id) ? ' owned' : '')
      + (shopArmed === it.id ? ' armed' : '')
      + (!isOwned(it.id) && G.gems < it.price ? ' locked' : '');
    b.innerHTML = `<span class="si">${it.icon}</span><span class="sn">${it.name}</span>`
      + (isOwned(it.id)
        ? `<span class="sp">${isEquipped(it.id) ? '✓ angelegt' : 'anlegen'}</span>`
        : `<span class="sp">💎 ${it.price}${shopArmed === it.id ? ' · nochmal tippen!' : ''}</span>`);
    b.addEventListener('click', () => tapShopItem(it));
    grid.appendChild(b);
  });
}
function tapShopItem(it) {
  sndTap();
  if (isOwned(it.id)) {
    toggleEquip(it.id);
    sayStorySeq([{ voice: 'narrator', text: isEquipped(it.id) ? SHOP_FIXED[3] : SHOP_FIXED[4] }]);
    saveActive(); shopArmed = null; renderShop(); return;
  }
  if (G.gems < it.price) {
    sayStorySeq([
      { voice: 'narrator', text: shopItemLine(it.name, it.price) },
      { voice: 'narrator', text: SHOP_FIXED[5] }
    ]);
    shopArmed = null; renderShop(); return;
  }
  if (shopArmed !== it.id) {
    shopArmed = it.id;
    sayStorySeq([
      { voice: 'narrator', text: shopItemLine(it.name, it.price) },
      { voice: 'narrator', text: SHOP_FIXED[1] }
    ]);
    renderShop(); return;
  }
  buyItem(it.id);
  sndGem();
  sayStorySeq([{ voice: 'narrator', text: SHOP_FIXED[2] }]);
  renderHUD(); saveActive(); shopArmed = null; renderShop();
}
function openShop() {
  shopArmed = null; renderShop(); ovOn('shopOv');
  sayStorySeq([{ voice: 'narrator', text: SHOP_FIXED[0] }]);
}

/* ---------- Gebiet geschafft ---------- */
export function showFloorClear() {
  sndWin();
  const quote = FLOOR_QUOTES[(G.floor - 1) % FLOOR_QUOTES.length];
  const boss = BOSSES[Math.min(G.floor - 1, BOSSES.length - 1)];
  document.getElementById('floorSub').innerHTML =
    `Du hast den Schatten gebrochen –<br><b style="color:#e9d5ff">${boss.freed}</b> ist wieder frei und beschützt den Wald:` +
    (G.companion ? `<br><i style="color:#b8ffd9">${G.companion.icon} „${quote}"</i>` : '');
  document.getElementById('trophyRow').textContent = G.trophies.join(' ');
  document.getElementById('floorStats').innerHTML = `
    <div class="stat"><div class="n">${G.gems}</div><div class="l">💎 GESAMT</div></div>
    <div class="stat"><div class="n">${G.kills}</div><div class="l">TIERE BEFREIT</div></div>
    <div class="stat"><div class="n">${G.trophies.length}</div><div class="l">WÄCHTER</div></div>`;
  ovOn('floorOv');
  /* Runden-Abschluss (alle 6 Wächter): großer Moment + Überleitung */
  const allFreed = G.floor % 6 === 0;
  const seq = [{ voice: 'narrator', text: allFreed ? FLOOR_DONE_ALL : FLOOR_DONE }];
  if (G.companion && !allFreed) seq.push({ voice: 'companion', text: quote });
  sayStorySeq(seq);
}
function nextFloor() {
  ovOff('floorOv');
  G.floor++; G.hearts = Math.min(5, G.hearts + 2); renderHearts();
  playLevelMusic(G.floor); /* Track-Wechsel je Gebiet (hell/düster) */
  saveActive(); /* Checkpoint: neues Gebiet ist der Wiedereinstiegspunkt */
  /* Biom-Name als freiwilliges Zusatzlesen (schöne Komposita!) */
  document.getElementById('floorTag').textContent = 'GEBIET ' + G.floor + ' · ' + biomeFor(G.floor).name;
  announce('GEBIET ' + G.floor, 1200);
  planFloor();
  setTimeout(advance, 700);
}

/* ---------- Button-/Regler-Verdrahtung (statt Inline-onclick) ---------- */
export function wireOverlays() {
  document.querySelectorAll('.adultLink').forEach(b => b.addEventListener('click', openAdult));
  document.getElementById('adultCloseBtn').addEventListener('click', () => ovOff('adultOv'));
  document.getElementById('resumeBtn').addEventListener('click', () => ovOff('pauseOv'));
  document.getElementById('restartBtn').addEventListener('click', () => location.reload());
  document.getElementById('nextFloorBtn').addEventListener('click', nextFloor);
  /* Lagerfeuer: sichtbarer Fortschritt nach jedem Gebiets-Sieg */
  document.getElementById('campBtn').addEventListener('click', () => {
    ovOff('floorOv');
    enterCamp();
  });
  document.getElementById('campLeaveBtn').addEventListener('click', () => {
    leaveCamp(nextFloor);
  });
  document.getElementById('shopBtn').addEventListener('click', openShop);
  document.getElementById('shopCloseBtn').addEventListener('click', () => ovOff('shopOv'));
  document.getElementById('fishBtn').addEventListener('click', () => startFishing());
  document.getElementById('archBtn').addEventListener('click', () => startArchery());
  document.getElementById('setDoneBtn').addEventListener('click', () => ovOff('setOv'));
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('pauseBtn').addEventListener('click', openPause);

  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => setQuality(c.dataset.q === 'auto' ? 'auto' : +c.dataset.q));
  });
  document.getElementById('resSlider').addEventListener('input', e => {
    setRES(e.target.value / 100);
    document.getElementById('resVal').textContent = e.target.value + '%';
  });
  document.getElementById('voiceToggle').addEventListener('click', () => {
    const t = document.getElementById('voiceToggle');
    t.classList.toggle('on');
    setVoiceOn(t.classList.contains('on'));
  });

  /* Getrennte Lautstärken für Stimme/Musik/Effekte (persistiert) */
  const vols = [
    ['volVoice', getVoiceVol, setVoiceVol, null],
    ['volMusic', getMusicVol, setMusicVol, refreshAmbience],
    ['volSfx', getSfxVol, setSfxVol, () => sndGem(0)] /* Hör-Feedback */
  ];
  vols.forEach(([id, get, set, sample]) => {
    const el = document.getElementById(id);
    el.value = Math.round(get() * 100);
    el.addEventListener('input', e => set(e.target.value / 100));
    if (sample) el.addEventListener('change', sample);
  });

  document.getElementById('cwTier').addEventListener('change', loadCustomWordsUI);
  document.getElementById('cwSave').addEventListener('click', saveCustomWordsUI);
  /* Wortschatz-Pakete + Spielstand-Datei */
  fillPackSelect();
  document.getElementById('packApply').addEventListener('click', applyPackUI);
  document.getElementById('saveExport').addEventListener('click', exportSaveUI);
  document.getElementById('saveImport').addEventListener('click', () =>
    document.getElementById('saveFile').click());
  document.getElementById('saveFile').addEventListener('change', e => {
    if (e.target.files[0]) importSaveUI(e.target.files[0]);
    e.target.value = '';
  });

  /* dezentes Tap-Feedback auf allen statischen Buttons */
  document.querySelectorAll('.play, .ghost, .chip, #settingsBtn, #pauseBtn, #hornBtn').forEach(b =>
    b.addEventListener('pointerdown', sndTap));
}
