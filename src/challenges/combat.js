/* ---------- Kampf: Zauber abfeuern, Befreien, Gegnerzug ----------
   Fehlerfreies Lesen → KRITISCH + Combo (Belohnung statt Bestrafung). */
import * as THREE from 'three';
import { screenShake } from '../engine/camera.js';
import { addAnim } from '../engine/anims.js';
import { burst, shootSpell } from '../engine/effects.js';
import { G } from '../state.js';
import { M, flashModel, tintRage, setMobHp, freeMobVisual, releaseFreedAnimal } from '../creatures/mob.js';
import { stationDone } from '../world/stations.js';
import { rigPos } from '../engine/camera.js';
import { renderHearts } from '../ui/hud.js';
import { announce, flyText } from '../ui/feedback.js';
import { ovOff } from '../ui/overlays.js';
import { sndBoom, sndFree, sndGrowl, sndCrit, tone } from '../audio/sfx.js';
import { setBossAura } from '../audio/ambience.js';
import { playLevelMusic } from '../audio/music.js';
import { startWordChallenge } from './spell.js';
import { startBlitz } from './blitz.js';
import { spawnGemReward } from './reward.js';
import { playScene, showBubble } from '../story/scenes.js';
import { companionJoinScene, COMPANION_CHEER, BOSS_DEFEAT, UI_LINES } from '../story/content.js';
import { sayGame } from '../audio/tts.js';

export function castSpell() {
  const crit = G.errors === 0;
  G.combo = crit ? G.combo + 1 : 0;
  const target = M.group.position.clone().add(new THREE.Vector3(0, M.group.userData.hoverY > 0 ? .3 : 1.4, 0));
  shootSpell(target, () => {
    sndBoom(); screenShake(crit ? 1.4 : 1);
    burst(target, crit ? 30 : 20, [0xb6f7c2, 0x46d68a, 0xffffff, 0xffd34a]);
    {
      let t = 0;
      addAnim({ update(dt) {
        t += dt * 7;
        flashModel(Math.max(0, 1 - t));
        if (t >= 1) { flashModel(0); return true; } return false;
      } });
    }
    let dmg = 30 + Math.floor(Math.random() * 8) + (crit ? 22 : 0) + G.buff;
    if (G.buff) { G.buff = 0; document.getElementById('buffTag').classList.remove('on'); }
    if (G.combo >= 2) dmg = Math.round(dmg * (1 + Math.min(.5, G.combo * .1)));
    G.mob.hp -= dmg; setMobHp();
    flyText(target.clone().add(new THREE.Vector3(0, 2.3, 0)), '-' + dmg, crit ? '#ffd34a' : '#b6f7c2', crit ? 40 : 30);
    if (crit) { announce('KRITISCH!', 700); sndCrit(); }
    if (G.combo >= 2) {
      const c = document.getElementById('comboTag');
      c.textContent = `🔥 COMBO x${G.combo}`; c.classList.add('on');
    } else document.getElementById('comboTag').classList.remove('on');

    setTimeout(() => {
      document.getElementById('spellWord').innerHTML = '';
      if (G.mob.hp <= 0) killMob();
      else mobTurn();
    }, 650);
  });
}
export function killMob() {
  sndFree();
  const pos = M.group.position.clone();
  const wasBoss = G.mob.boss, animal = G.mob.animal, bossSym = G.mob.def.sym;
  burst(pos.clone().add(new THREE.Vector3(0, 1, 0)), 34,
    [0xffffff, 0xffe9a3, wasBoss ? 0x9b59c9 : 0x46d68a], true);
  announce('BEFREIT! 🕊', 1000); /* auch Wächter werden erlöst, nie besiegt */
  /* Tier wird befreit: Verzauberung fällt ab, es fliegt davon */
  freeMobVisual();
  document.getElementById('mobBar').classList.remove('on');
  screenShake(1.2);

  const g = wasBoss ? 8 : 3 + Math.floor(Math.random() * 3);
  /* Loot fällt vor den Geist Richtung Spieler – kollidiert nicht
     mit der parallel laufenden Befreiungs-Szene des Tiers */
  const drop = pos.clone().add(rigPos.clone().sub(pos).setY(0).normalize().multiplyScalar(2.2));
  drop.y = .5;

  G.kills++; G.mob = null; G.word = null; G.busy = true; G.mode = null;

  /* Das Tier bleibt dem Spieler zugewandt, bis Belohnung + Dialog
     fertig sind – erst dann fliegt/galoppiert es davon */
  let afterReward = () => { releaseFreedAnimal(); setTimeout(stationDone, 250); };
  if (wasBoss) {
    setBossAura(false); /* die Schatten-Aura verklingt mit der Erlösung */
    playLevelMusic(G.floor); /* Boss-Thema endet, Wald-Musik kehrt zurück */
    /* Boss-Abgangszeile (gewaltarm: der Schatten zerfällt) */
    setTimeout(() => showBubble(bossSym, BOSS_DEFEAT[Math.min(G.floor - 1, BOSS_DEFEAT.length - 1)], 'boss'), 600);
  } else if (!G.companion) {
    /* Das erste befreite Tier wird Begleiter und Erzähler-Stimme */
    G.companion = { key: animal.key, icon: animal.icon, name: animal.name };
    afterReward = () => playScene(companionJoinScene(G.companion),
      () => { releaseFreedAnimal(); setTimeout(stationDone, 250); });
  } else if (Math.random() < .35) {
    setTimeout(() => showBubble(G.companion.icon,
      COMPANION_CHEER[Math.floor(Math.random() * COMPANION_CHEER.length)]), 1600);
    /* Jubel läuft noch ~3 s nach der Belohnung → Abflug etwas verzögern */
    afterReward = () => { setTimeout(releaseFreedAnimal, 2800); setTimeout(stationDone, 250); };
  }
  spawnGemReward(drop, g, afterReward);
}

/* ---------- Gegnerzug ---------- */
export function mobTurn() {
  /* höhere Runden: Geister greifen öfter an (mehr Blitzlesen-Druck) */
  const round = Math.floor((G.floor - 1) / 6);
  if (Math.random() < Math.max(.3, .5 - round * .08)) { setTimeout(() => startWordChallenge('spell'), 500); return; }
  sndGrowl();
  /* hörbares Angriffs-Signal – optional: entfällt, wenn gerade gesprochen wird */
  sayGame(UI_LINES.shieldAlert, false, true);
  {
    let t = 0;
    addAnim({ update(dt) {
      t += dt * 5;
      tintRage(Math.abs(Math.sin(t)));
      if (t > 4) { tintRage(0); return true; } return false;
    } });
  }
  setTimeout(() => startBlitz('fight'), 700);
}

export function revive() {
  ovOff('deadOv');
  G.hearts = 5; renderHearts();
  tone(523, .12); tone(784, .14, 'square', .1, .1);
  setTimeout(() => startWordChallenge('spell'), 400);
}
