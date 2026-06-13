/* =====================================================================
   DAS LAGER – sichtbarer Fortschritt (Roadmap 2)
   Entsteht nach dem Boss-Sieg direkt in der Lichtung: Lagerfeuer in
   der Dämmerung, die befreiten Wächter und Tierarten versammeln sich.
   Antippen = der Wächter spricht seine Befreiungszeile (Audio-First).
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rigPos, rigFocus } from '../engine/camera.js';
import { addAnim, easeOut } from '../engine/anims.js';
import { glowSprite } from '../engine/textures.js';
import { G } from '../state.js';
import { ANIMALS, BOSSES } from '../creatures/data.js';
import { loadModelOnce, pickClip } from '../creatures/models.js';
import { BOSS_DEFEAT, COMPANION_CHEER } from '../story/content.js';
import { CAMP_SWAP } from '../learning/speech-lines.js';
import { sayStory } from '../audio/tts.js';
import { sndTap } from '../audio/sfx.js';
import { toonMat } from '../engine/materials.js';
import { saveActive } from '../meta/save.js';

let campGrp = null;
export let campTargets = [];
let companionMark = null; /* Markierung unter dem aktuellen Begleiter */

function emojiSprite(emoji, size = 2) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.font = '180px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 18;
  ctx.fillText(emoji, 128, 140);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(size, size, 1);
  return sp;
}

export function enterCamp() {
  const st = G.stations[G.stations.length - 1]; /* Boss-Lichtung */
  const center = st.pos.clone();
  campGrp = new THREE.Group();
  campTargets = [];
  companionMark = null;
  G.state = 'camp'; G.mode = 'camp'; G.busy = false;

  /* Lagerfeuer: Holz, Glut-Glühen, steigende Funken, warmes Licht */
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.5, 6),
      toonMat({ color: 0x5e4528 }));
    log.rotation.z = Math.PI / 2; log.rotation.y = (i / 4) * Math.PI;
    log.position.copy(center); log.position.y = .15;
    campGrp.add(log);
  }
  const glow = glowSprite(0xff9a3c, 4); glow.position.copy(center); glow.position.y = .8;
  campGrp.add(glow);
  const fire = new THREE.PointLight(0xff8c3c, 2.2 * Math.PI, 26, 1.6);
  fire.position.copy(center); fire.position.y = 1.4;
  campGrp.add(fire);
  let ft = 0;
  addAnim({ update(dt) {
    if (!campGrp) return true;
    ft += dt;
    fire.intensity = (2.0 + Math.sin(ft * 9) * .35 + Math.sin(ft * 23) * .2) * Math.PI;
    glow.scale.setScalar(3.6 + Math.sin(ft * 7) * .5);
    return false;
  } });
  /* Funken */
  addAnim({ s: 0, update(dt) {
    if (!campGrp) return true;
    this.s += dt;
    if (this.s > .22) {
      this.s = 0;
      const sp = glowSprite(0xffc06a, .25 + Math.random() * .3);
      sp.position.copy(center).add(new THREE.Vector3((Math.random() - .5) * .8, .7, (Math.random() - .5) * .8));
      campGrp.add(sp);
      let life = 0;
      addAnim({ update(d2) {
        life += d2;
        sp.position.y += d2 * (1.2 + Math.random() * .6);
        sp.material.opacity = Math.max(0, 1 - life / 1.4);
        if (life > 1.4 || !campGrp) { campGrp && campGrp.remove(sp); return true; }
        return false;
      } });
    }
    return false;
  } });

  /* Befreite Wächter im Halbkreis hinter dem Feuer – wo es ein echtes
     Modell gibt, sitzt das Tier leibhaftig am Feuer (Idle-Animation),
     sonst Emoji-Sprite auf Podest */
  const campMixers = [];
  const freedBosses = BOSSES.filter(b => G.trophies.includes(b.trophy));
  freedBosses.forEach((b, i) => {
    const a = Math.PI * (.25 + .5 * (i / Math.max(1, freedBosses.length - 1 || 1)));
    const p = center.clone().add(new THREE.Vector3(Math.cos(a) * 6.5, 0, -Math.abs(Math.sin(a)) * 6.5));
    const say = { voice: 'boss', text: BOSS_DEFEAT[BOSSES.indexOf(b)] };
    if (b.model) {
      loadModelOnce(b.model.key, b.model.url, { toon: true }).then(model => {
        if (!model || !campGrp) return;
        const holder = new THREE.Group();
        const ms = model.scene;
        ms.position.set(0, 0, 0); ms.rotation.set(0, 0, 0);
        ms.scale.setScalar(b.model.scale);
        holder.add(ms);
        holder.position.set(p.x, 0, p.z);
        /* Blick zum Feuer */
        holder.rotation.y = Math.atan2(center.x - p.x, center.z - p.z);
        holder.userData.campSay = say;
        holder.userData.grounded = true;
        campGrp.add(holder);
        campTargets.push(holder);
        if (model.clips.length) {
          const mix = new THREE.AnimationMixer(ms);
          mix.clipAction(pickClip(model.clips, 'Idle', 'Idle_2', 'Eating')).play();
          campMixers.push(mix);
        }
      });
      return;
    }
    const sp = emojiSprite(b.sym, 2.6);
    sp.position.set(p.x, 1.6, p.z);
    sp.userData.campSay = say;
    campGrp.add(sp);
    campTargets.push(sp);
    const podest = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.1, .5, 8),
      toonMat({ color: 0x8a8a92 }));
    podest.position.set(p.x, .25, p.z);
    campGrp.add(podest);
  });
  /* Wächter-Animationen treiben, solange das Lager steht */
  addAnim({ update(dt) {
    if (!campGrp) return true;
    campMixers.forEach(m => m.update(dt));
    return false;
  } });

  /* Befreite Tierarten näher am Feuer – antippen macht sie zum BEGLEITER
     (kosmetisch, Audio-First). Eine Markierung zeigt den aktuellen. */
  const species = ANIMALS.filter(a => (G.freedSpecies[a.key] || 0) > 0);
  species.forEach((an, i) => {
    const a = Math.PI * (1.15 + .7 * (i / Math.max(1, species.length - 1 || 1)));
    const p = center.clone().add(new THREE.Vector3(Math.cos(a) * 4.2, 0, -Math.sin(a) * 4.2));
    const sp = emojiSprite(an.icon, 1.8);
    sp.position.set(p.x, 1.1, p.z);
    sp.userData.campSay = { voice: 'companion',
      text: COMPANION_CHEER[i % COMPANION_CHEER.length] };
    sp.userData.swap = { key: an.key, name: an.name, icon: an.icon };
    sp.userData.bob = Math.random() * 6;
    campGrp.add(sp);
    campTargets.push(sp);
    if (G.companion && G.companion.key === an.key) markCompanion(sp);
  });
  /* sanftes Schweben der Figuren */
  addAnim({ t: 0, update(dt) {
    if (!campGrp) return true;
    this.t += dt;
    campTargets.forEach(s => {
      if (s.userData.grounded) return; /* echte Tiere stehen fest am Boden */
      const b = s.userData.bob || 0;
      s.position.y = (s.userData.baseY ?? (s.userData.baseY = s.position.y)) + Math.sin(this.t * 1.4 + b) * .1;
    });
    return false;
  } });

  scene.add(campGrp);
  /* Kamera leicht zurück und aufs Feuer */
  rigFocus.set(center.x, 1.4, center.z);
  rigPos.set(rigPos.x, 3.2, rigPos.z);
  document.getElementById('campBar').classList.add('on');
}

/* Leuchtring unter dem aktuellen Begleiter (wandert beim Tausch mit) */
function markCompanion(sp) {
  if (!campGrp) return;
  if (companionMark) campGrp.remove(companionMark);
  companionMark = glowSprite(0x9fe8ff, 1.8);
  companionMark.material.opacity = .7;
  companionMark.position.set(sp.position.x, .35, sp.position.z);
  campGrp.add(companionMark);
}

export function tapCamp(obj) {
  let o = obj;
  while (o && !o.userData.campSay && !o.userData.swap) o = o.parent;
  if (!o) return;
  sndTap();
  /* befreites Tier antippen, das noch nicht Begleiter ist → Tausch */
  const sw = o.userData.swap;
  if (sw && (!G.companion || G.companion.key !== sw.key)) {
    G.companion = { key: sw.key, icon: sw.icon, name: sw.name };
    markCompanion(o);
    sayStory('companion', CAMP_SWAP);
    saveActive();
  } else if (o.userData.campSay) {
    const s = o.userData.campSay;
    sayStory(s.voice, s.text);
  }
  /* kleiner Freuden-Hüpfer */
  let t = 0; const base = o.position.y;
  addAnim({ update(dt) {
    t += dt * 4;
    o.position.y = base + Math.sin(Math.min(Math.PI, t)) * .5;
    if (t >= Math.PI) { o.position.y = base; return true; }
    return false;
  } });
}

export function leaveCamp(onLeft) {
  document.getElementById('campBar').classList.remove('on');
  const g = campGrp; campGrp = null;
  campTargets = [];
  G.mode = null; G.busy = true;
  if (g) {
    let t = 0;
    addAnim({ update(dt) {
      t += dt * 1.6;
      g.scale.setScalar(Math.max(.001, 1 - easeOut(Math.min(1, t))));
      if (t >= 1) { scene.remove(g); return true; }
      return false;
    } });
  }
  if (onLeft) onLeft();
}
