/* =====================================================================
   KREATUREN
   Der sichtbare Gegner ist IMMER der Schattengeist (Shader-Blob) –
   auf das Tier selbst wird nie geschossen (Invariante: Tiere werden
   befreit, nicht getötet). Das GLTF-Tier erscheint erst im
   Befreiungsmoment und fliegt/galoppiert davon.
   Blobs sind zudem billiger als skelett-animierte GLTFs → alte iPads.
   M bündelt alle veränderlichen Visual-Referenzen des aktiven Gegners.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rigPos } from '../engine/camera.js';
import { addAnim, easeOut, easeInOut } from '../engine/anims.js';
import { glowSprite, blobShadow } from '../engine/textures.js';
import { GLSL_NOISE } from '../world/terrain.js';
import { G } from '../state.js';
import { ANIMALS, BOSSES } from './data.js';
import { MODELS, loadModelOnce, pickClip } from './models.js';
import { sndGrowl } from '../audio/sfx.js';
import { announce } from '../ui/feedback.js';
import { toonMat } from '../engine/materials.js';

/* ---------- Distinkte Wächter-Silhouetten (verdorbene Schatten-Gestalten) ----------
   Jeder Boss kriegt eigene Form-Merkmale aus dunklen Toon-Meshes, an die
   lookAt-gedrehte Gruppe gehängt (Ohren/Schnauze nach +z = zur Kamera,
   Geweih/Krone nach +y = oben). So fühlt sich jeder Wächter eigen an. */
function bossFeatures(form, group, R, color) {
  const mat = toonMat({ color: new THREE.Color(color).multiplyScalar(0.6), side: THREE.DoubleSide });
  const cone = (r, h) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat);
  const ball = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
  const cyl = (r1, r2, h) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 6), mat);
  const put = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); group.add(m); return m; };
  if (form === 'wolf' || form === 'fuchs') {
    const big = form === 'fuchs' ? 1.3 : 1;          /* Fuchs = größere, spitzere Ohren */
    [-1, 1].forEach(s => put(cone(R * .32 * big, R * .85 * big), s * R * .5, R * .95, R * .15, 0, 0, s * -.32));
    put(cone(R * .42, R * .85), 0, R * .02, R * 1.0, Math.PI / 2, 0, 0); /* Schnauze nach vorn */
  } else if (form === 'baerin') {
    [-1, 1].forEach(s => put(ball(R * .33), s * R * .55, R * .9, R * .12)); /* runde Ohren */
    put(ball(R * .55), 0, -R * .12, R * .98);                               /* breite Schnauze */
  } else if (form === 'adler') {
    [-1, 1].forEach(s => { const w = cone(R * .62, R * 2.5); w.scale.set(1, 1, .2); put(w, s * R * 1.15, R * .25, -R * .25, 0, 0, s * (Math.PI / 2.1)); });
    put(cone(R * .3, R * .8), 0, 0, R * 1.05, Math.PI / 2, 0, 0);           /* Schnabel */
  } else if (form === 'hirsch') {
    [-1, 1].forEach(s => {
      put(cyl(R * .07, R * .1, R * 1.4), s * R * .4, R * 1.35, 0, 0, 0, s * .28);  /* Geweih-Stange */
      put(cyl(R * .04, R * .06, R * .65), s * R * .72, R * 1.7, 0, 0, 0, s * 1.0); /* Spross 1 */
      put(cyl(R * .04, R * .06, R * .55), s * R * .28, R * 2.0, 0, 0, 0, s * -.35);/* Spross 2 */
    });
  } else if (form === 'koenig') {
    for (let i = 0; i < 7; i++) {                                            /* Dornen-Krone */
      const a = (i / 7) * Math.PI * 2;
      put(cone(R * .14, R * .62), Math.cos(a) * R * .6, R * 1.05, Math.sin(a) * R * .6 + R * .15);
    }
  }
}

export const M = { group: null, mat: null, shadow: null };

function blobMaterial(colorHex, amp) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmp: { value: amp },
      uColor: { value: new THREE.Color(colorHex) }, uFlash: { value: 0 }, uTint: { value: 0 } },
    vertexShader: `
      uniform float uTime;uniform float uAmp;
      varying vec3 vN;varying vec3 vPos;
      ${GLSL_NOISE}
      void main(){
        vN=normalMatrix*normal;
        vec3 p=position;
        float n=fbm(position*1.4+vec3(0.0,uTime*0.7,uTime*0.25));
        p+=normal*(n-0.5)*uAmp;
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        vPos=mv.xyz;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;uniform float uFlash;uniform float uTint;
      varying vec3 vN;varying vec3 vPos;
      void main(){
        vec3 n=normalize(vN);
        float diff=max(dot(n,normalize(vec3(0.45,0.8,0.4))),0.0);
        vec3 V=normalize(-vPos);
        float rim=pow(1.0-max(dot(n,V),0.0),2.6);
        vec3 col=uColor*(0.45+0.62*diff);
        col+=vec3(0.75,0.86,1.0)*rim*0.35;
        col=mix(col,vec3(1.0,0.15,0.2),uTint*0.5);
        col=mix(col,vec3(1.0),uFlash);
        gl_FragColor=vec4(col,1.0);
      }`,
    fog: false
  });
}
export function flashModel(amt) {
  if (M.mat) M.mat.uniforms.uFlash.value = amt;
}
export function tintRage(amt) {
  if (M.mat) M.mat.uniforms.uTint.value = amt;
}

export function spawnMob(st, isBoss) {
  if (M.group) despawnMobVisual();
  M.group = new THREE.Group();
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const def = isBoss ? BOSSES[Math.min(G.floor - 1, BOSSES.length - 1)] : animal;
  /* Wächter-Modell schon beim Boss-Spawn vorladen → Befreiung ist sofort da */
  if (isBoss && def.model) loadModelOnce(def.model.key, def.model.url, { toon: true });

  /* Schattengeist-Blob (Augen zur Kamera via lookAt unten) */
  const fb = animal.fb;
  const baseR = isBoss ? (def.form === 'koenig' ? 2.7 : 2.35) : 1.9;
  M.mat = blobMaterial(isBoss ? def.dark : fb.color, isBoss ? .8 : fb.amp);
  const body = new THREE.Mesh(new THREE.SphereGeometry(baseR, 48, 36), M.mat);
  body.scale.y = isBoss ? 1.15 : fb.squash;
  M.group.add(body);
  [-1, 1].forEach(sx => {
    const r = isBoss ? .3 : .25;
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10),
      new THREE.MeshBasicMaterial({ color: isBoss ? 0xff2e4d : fb.eye }));
    e.position.set(sx * baseR * .38, baseR * .28, baseR * .86);
    M.group.add(e);
    /* Kawaii-Glanzpunkt im Auge */
    const glint = new THREE.Mesh(new THREE.SphereGeometry(r * .35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(sx * baseR * .38 - sx * .08, baseR * .28 + r * .35, baseR * .86 + r * .55);
    M.group.add(glint);
  });
  const hoverY = 2.5;

  if (isBoss) {
    const aura = glowSprite(def.aura, 10); aura.material.opacity = .5;
    aura.position.y = 0;
    M.group.add(aura);
    /* eigene verdorbene Gestalt je Wächter (Ohren/Geweih/Flügel/Krone …) */
    bossFeatures(def.form, M.group, baseR, def.dark);
  }
  /* Schatten STANDALONE auf dem Boden – NICHT als Kind der Gruppe, sonst
     erbt der flache Schatten deren lookAt-Rotation + Spawn-Skalierung und
     kippt/flackert (Playtest-Bug). Liegt fest flach unter dem Gegner. */
  M.shadow = blobShadow(5);
  M.shadow.position.set(st.pos.x, .06, st.pos.z);
  scene.add(M.shadow);

  M.group.userData.hoverY = hoverY;
  M.group.position.copy(st.pos); M.group.position.y = hoverY;
  M.group.lookAt(rigPos.x, hoverY, rigPos.z);
  M.group.scale.setScalar(.001);
  scene.add(M.group);

  /* Runde 2+ (nach dem erlösten König): Schatten-Echos werden zäher.
     Schwierigkeit wächst primär über Mechanik-Tempo (Blitz-Timer,
     Angriffsfrequenz), HP nur moderat – NIE über schwerere Wörter. */
  const round = Math.floor((G.floor - 1) / 6);
  const hp = Math.round(((isBoss ? def.hp : animal.hp) + (G.floor >= 4 ? 20 : 0)) * (1 + round * .2));
  G.mob = { def, animal, name: isBoss ? def.name : animal.name, hp, max: hp, boss: isBoss, st,
    color: isBoss ? 0x9b59c9 : animal.fb.color };
  const grp = M.group;
  addAnim({ t: 0, update(dt) {
    this.t += dt * 2.4;
    const k = Math.min(1, this.t); grp.scale.setScalar(.2 + .8 * easeOut(k));
    if (k >= 1) { grp.scale.setScalar(1); return true; } return false;
  } });
  setTimeout(() => { if (M.group && M.group.scale.x < .9) M.group.scale.setScalar(1); }, 900);
  sndGrowl();
  document.getElementById('mobName').innerHTML =
    isBoss ? `<span class="boss">${def.sym} ${G.mob.name}</span>` : 'Befreie: ' + G.mob.name;
  setMobHp();
  document.getElementById('mobBar').classList.add('on');
  if (isBoss) announce('BOSS!', 1100);
}
export function despawnMobVisual() {
  scene.remove(M.group);
  if (M.shadow) scene.remove(M.shadow);
  M.group = null; M.shadow = null; M.mat = null;
}
export function setMobHp() {
  document.getElementById('mobHpFill').style.width = Math.max(0, (G.mob.hp / G.mob.max * 100)) + '%';
}

/* Befreiung: Der Schattengeist löst sich auf – und das befreite Tier
   erscheint und entkommt (Blickrichtung = Bewegungsrichtung). */
export function freeMobVisual() {
  const grp = M.group;
  const shadow = M.shadow;
  const boss = G.mob && G.mob.boss ? G.mob.def : null;
  const animal = G.mob && !G.mob.boss ? G.mob.animal : null;
  M.group = null; M.shadow = null; M.mat = null;
  let t = 0;
  addAnim({ update(dt) {
    t += dt * 4;
    grp.scale.setScalar(Math.max(.001, 1 - t));
    grp.rotation.y += dt * 9;
    if (shadow) shadow.material.opacity = Math.max(0, 1 - t); /* Schatten mit auflösen */
    if (t >= 1) { scene.remove(grp); if (shadow) scene.remove(shadow); return true; }
    return false;
  } });
  if (animal) revealFreedAnimal(animal, grp.position.clone());
  /* Wächter mit echtem Modell: erscheint befreit, schaut den Spieler an,
     kehrt dann in seinen Wald zurück (gleicher Flow wie die Tiere) */
  else if (boss && boss.model) revealFreedAnimal(
    { key: boss.model.key, scale: boss.model.scale, grounded: true, y: 0 },
    grp.position.clone());
}

let releaseAnimalFn = null;
/* Vom Kampf-Flow gerufen, wenn Belohnung + Dialog fertig sind:
   erst DANN dreht sich das Tier um und entkommt */
export function releaseFreedAnimal() {
  if (releaseAnimalFn) { releaseAnimalFn(); releaseAnimalFn = null; }
}

export function revealFreedAnimal(animal, pos) {
  const model = MODELS[animal.key];
  if (!model) return; /* Modell (noch) nicht geladen → nur Auflösungs-Effekt */
  const g = new THREE.Group();
  const ms = model.scene; /* Instanz wird wiederverwendet – nur 1 Befreiung gleichzeitig */
  ms.position.set(0, 0, 0); ms.rotation.set(0, 0, 0);
  ms.scale.setScalar(animal.scale);
  g.add(ms);
  let mix = null, fleeAct = null;
  if (model.clips.length) {
    mix = new THREE.AnimationMixer(ms);
    const idle = pickClip(model.clips, 'Idle', 'Idle_2');
    const act = mix.clipAction(idle);
    act.play();
    /* Quaternius-Tiere: beim Entkommen in den Galopp wechseln */
    const gallop = pickClip(model.clips, 'Gallop', 'Walk');
    if (gallop && gallop !== idle) fleeAct = () => {
      act.fadeOut(.25);
      mix.clipAction(gallop).reset().fadeIn(.25).play();
    };
  }
  /* Das Tier wendet sich dem Spieler zu und BLEIBT, solange gesprochen
     wird (Begleiter-Szene, Jubel) – Abflug erst nach releaseFreedAnimal()
     bzw. spätestens nach 12 s Sicherheitsnetz */
  const dir = pos.clone().sub(rigPos).setY(0).normalize();
  const grounded = animal.grounded;
  pos.y = grounded ? 0 : Math.max(pos.y, animal.y);
  const baseY = pos.y;
  /* Modell-Front ist +z → yawFace richtet sie zum Spieler */
  const yawFace = Math.atan2(rigPos.x - pos.x, rigPos.z - pos.z);
  g.position.copy(pos);
  g.rotation.y = yawFace;
  g.scale.setScalar(.001);
  scene.add(g);
  let released = false;
  releaseAnimalFn = () => { released = true; };
  let phase = 0, pt = 0, total = 0;
  addAnim({ update(dt) {
    pt += dt; total += dt;
    if (mix) mix.update(dt);
    if (phase === 0) { /* erscheinen, dem Spieler zugewandt */
      g.scale.setScalar(easeOut(Math.min(1, pt / .4)));
      if (pt >= .4) { phase = 1; pt = 0; }
    } else if (phase === 1) { /* verweilen & anschauen, bis Sprache fertig */
      if (!grounded) g.position.y = baseY + Math.sin(total * 3) * .15;
      if (released || pt > 12) { phase = 2; pt = 0; }
    } else if (phase === 2) { /* umdrehen */
      g.rotation.y = yawFace + easeInOut(Math.min(1, pt / .5)) * Math.PI;
      if (pt >= .5) { phase = 3; pt = 0; if (fleeAct) fleeAct(); }
    } else { /* entkommen */
      g.position.addScaledVector(dir, dt * (grounded ? 7 : 4));
      if (!grounded) g.position.y += dt * 5;
      if (pt >= 2) { mix && mix.stopAllAction(); g.remove(ms); scene.remove(g); return true; }
    }
    return false;
  } });
}

/* ---------- Intro-Inszenierung: der Schwarze König auf dem Pfad ---------- */
let kingGrp = null;
export function showKingSilhouette() {
  kingGrp = new THREE.Group();
  const mat = blobMaterial(0x1c1430, .7);
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.1, 40, 30), mat);
  body.scale.y = 1.3;
  kingGrp.add(body);
  [-1, 1].forEach(sx => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.26, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff2e4d }));
    e.position.set(sx * .8, .7, 1.75);
    kingGrp.add(e);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(sx * .8 - sx * .08, .79, 1.92);
    kingGrp.add(glint);
  });
  const aura = glowSprite(0x9b59c9, 9); aura.material.opacity = .45;
  kingGrp.add(aura);
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.font = '190px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 36;
  ctx.fillText('👑', 128, 140);
  const sym = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sym.scale.set(2.4, 2.4, 1); sym.position.set(0, 4.1, 0);
  kingGrp.add(sym);
  kingGrp.position.set(0, 2.4, -2); /* Spieler-Start blickt genau hierher */
  scene.add(kingGrp);
  let t = 0;
  addAnim({ update(dt) {
    if (!kingGrp) return true;
    t += dt;
    kingGrp.position.y = 2.4 + Math.sin(t * 1.4) * .18;
    mat.uniforms.uTime.value = t;
    return false;
  } });
}
export function removeKingSilhouette() {
  const g = kingGrp; kingGrp = null;
  if (!g) return;
  let t = 0;
  addAnim({ update(dt) {
    t += dt * 2.2;
    g.scale.setScalar(Math.max(.001, 1 - t));
    g.rotation.y += dt * 6;
    if (t >= 1) { scene.remove(g); return true; }
    return false;
  } });
}

export function updateMob(time) {
  if (M.mat) M.mat.uniforms.uTime.value = time;
  if (M.group && G.mob) {
    const bob = Math.sin(time * 1.6) * .18;
    M.group.position.y = M.group.userData.hoverY + bob;
    /* Schatten liegt fest am Boden; nur dezent kleiner, wenn der Geist
       höher schwebt (wirkt wie echter Wurfschatten) */
    if (M.shadow) M.shadow.scale.setScalar(1 - bob * .35);
  }
}
