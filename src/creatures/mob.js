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

/* ---------- Distinkte Wächter-Merkmale (verdorbene Schatten-Gestalten) ----------
   Die Form-Merkmale (Ohren/Schnauze/Schnabel/Geweih/Krone) hängen am KOPF
   (hc = Kopfzentrum, hr = Kopfradius) und sind auf den Kopf skaliert – nicht
   mehr auf eine Kugel geklebt. mat ist ein geteiltes Schatten-Material
   (erstarrt mit dem Rest). +z = zur Kamera, +y = oben. */
function bossFeatures(form, group, hc, hr, mat) {
  const cone = (r, h, seg = 9) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
  const ball = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat);
  const cyl = (r1, r2, h) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 7), mat);
  const put = (m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    m.position.set(hc.x + x, hc.y + y, hc.z + z); m.rotation.set(rx, ry, rz); group.add(m); return m;
  };
  if (form === 'wolf' || form === 'fuchs') {
    const big = form === 'fuchs' ? 1.35 : 1;            /* Fuchs = größere, spitzere Ohren */
    [-1, 1].forEach(s => put(cone(hr * .46 * big, hr * 1.35 * big), s * hr * .5, hr * .82, -hr * .1, 0, 0, s * -.26));
    put(cone(hr * .52, hr * 1.25), 0, -hr * .16, hr * .98, Math.PI / 2, 0, 0); /* Schnauze nach vorn */
  } else if (form === 'baerin') {
    [-1, 1].forEach(s => put(ball(hr * .42), s * hr * .78, hr * .72, -hr * .05)); /* runde Ohren */
    put(ball(hr * .58), 0, -hr * .22, hr * .9);                                   /* breite Schnauze */
  } else if (form === 'adler') {
    put(cone(hr * .4, hr * 1.05), 0, -hr * .12, hr * .95, Math.PI / 2, 0, 0);     /* Schnabel */
    [-1, 1].forEach(s => { const b = cone(hr * .26, hr * .55); put(b, s * hr * .4, hr * .55, hr * .1); }); /* Federohren */
  } else if (form === 'hirsch') {
    put(cone(hr * .5, hr * 1.25), 0, -hr * .12, hr * 1.0, Math.PI / 2, 0, 0);     /* lange Schnauze */
    [-1, 1].forEach(s => {
      put(cyl(hr * .12, hr * .17, hr * 2.0), s * hr * .5, hr * 1.35, 0, 0, 0, s * .3);  /* Geweih-Stange */
      put(cyl(hr * .08, hr * .12, hr * 1.05), s * hr * .98, hr * 2.1, 0, 0, 0, s * 1.0); /* Spross 1 */
      put(cyl(hr * .08, hr * .12, hr * .9), s * hr * .34, hr * 2.55, 0, 0, 0, s * -.32); /* Spross 2 */
    });
  } else if (form === 'koenig') {
    for (let i = 0; i < 7; i++) {                                                 /* Dornen-Krone */
      const a = (i / 7) * Math.PI * 2;
      put(cone(hr * .22, hr * 1.0), Math.cos(a) * hr * .82, hr * .9, Math.sin(a) * hr * .82 + hr * .12);
    }
  }
}

/* ---------- Schatten-Augen + Kawaii-Glanz, vorn am Kopf ---------- */
function addEyes(group, cx, cy, cz, r, spread, eyeColor) {
  [-1, 1].forEach(sx => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10),
      new THREE.MeshBasicMaterial({ color: eyeColor }));
    e.position.set(cx + sx * spread, cy, cz);
    group.add(e);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(r * .35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(cx + sx * spread - sx * .08, cy + r * .35, cz + r * .55);
    group.add(glint);
  });
}

/* ---------- Verdorbene Wächter-Gestalt: schwebendes Schatten-Wesen ----------
   Mehrere Schatten-Massen (Hinterleib, Brust, Hals, vorgestreckter Kopf)
   bilden eine echte Tier-Silhouette statt einer Kugel mit aufgesteckten
   Ohren. Alle Massen teilen sich M.mat → erstarren gemeinsam. Liefert das
   Kopfzentrum zurück (für Merkmale + Augen). */
function buildBossBody(form, R) {
  const grp = M.group;
  const mass = (r, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 26, 20), M.mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); grp.add(m); return m;
  };
  /* WICHTIG: Die Kamera blickt frontal auf den Gegner → die Silhouette muss
     in der BILD-Ebene (x hoch/breit) lesbar sein, nicht in der Tiefe (z).
     Darum: Kopf klar OBEN, Körper darunter, Merkmale breit (Ohren/Geweih/
     Flügel/Krone spannen seitlich auf). */
  let hc; /* Kopfzentrum */
  if (form === 'wolf' || form === 'fuchs' || form === 'baerin') {
    /* sitzendes Raubtier von vorn: Kopf über schmalerem Oberkörper */
    mass(R * .74, 0, -.32 * R, -.05 * R, .96, 1.04, .9);     /* Rumpf (sitzend) */
    mass(R * .58, 0, .42 * R, .12 * R, 1.06, .82, .82);      /* Schultern */
    hc = new THREE.Vector3(0, 1.04 * R, .2 * R);
    mass(R * .5, hc.x, hc.y, hc.z, 1.02, .94, 1.0);          /* Kopf oben */
    /* zwei Schatten-Pfoten vorn unten */
    [-1, 1].forEach(s => mass(R * .22, s * .34 * R, -.62 * R, .42 * R, 1, .9, 1));
  } else if (form === 'adler') {
    /* aufrechter Greif: schmaler Körper, breite Schwingen seitlich */
    mass(R * .56, 0, -.2 * R, 0, .82, 1.18, .8);             /* Rumpf */
    mass(R * .4, 0, .5 * R, .1 * R, .9, .85, .85);           /* Brust */
    hc = new THREE.Vector3(0, 1.0 * R, .16 * R);
    mass(R * .4, hc.x, hc.y, hc.z, 1, .96, 1.05);            /* Kopf */
    [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.ConeGeometry(R * .6, R * 2.7, 9), M.mat);
      w.scale.set(1, 1, .16); w.position.set(s * R * 1.05, R * .2, -R * .15); w.rotation.z = s * (Math.PI / 2.0); grp.add(w); });
  } else if (form === 'hirsch') {
    /* hoher Hirsch: schlanker Hals, Kopf oben, Geweih breit darüber */
    mass(R * .58, 0, -.22 * R, 0, .82, 1.12, .92);           /* Rumpf */
    mass(R * .34, 0, .56 * R, .12 * R, .74, 1.18, .74);      /* hoher Hals (verbunden) */
    hc = new THREE.Vector3(0, 1.06 * R, .18 * R);
    mass(R * .34, hc.x, hc.y, hc.z, .92, .98, 1.12);         /* schmaler Kopf */
  } else { /* koenig */
    /* hoch aufragende verhüllte Gestalt, breite Schultern, Krone */
    mass(R * .88, 0, -.42 * R, 0, 1.04, 1.16, .92);          /* Umhang (breite Basis) */
    mass(R * .62, 0, .46 * R, 0, 1.0, .96, .82);             /* Schultern */
    hc = new THREE.Vector3(0, 1.18 * R, .08 * R);
    mass(R * .42, hc.x, hc.y, hc.z, .94, 1.02, .94);         /* Kopf unter Krone */
  }
  return hc;
}

/* mats = alle Schatten-Materialien des aktiven Gegners (Körper + Merkmale).
   Solidify/Flash/Tint/uTime wirken auf ALLE → der Geist „erstarrt" als
   Ganzes (Manga-Solidify beim Zuschlagen). */
export const M = { group: null, mat: null, shadow: null, mats: [] };

function blobMaterial(colorHex, amp) {
  const m = new THREE.ShaderMaterial({
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
  m.userData.baseAmp = amp; /* für Solidify: uAmp → 0 friert das Wabern ein */
  return m;
}
/* Aufhellen (Treffer-Blitz) auf ALLEN Schatten-Materialien des Gegners */
export function flashModel(amt) {
  for (const m of M.mats) m.uniforms.uFlash.value = amt;
}
/* Rot-Tönung (Wut/Angriff) auf allen Schatten-Materialien */
export function tintRage(amt) {
  for (const m of M.mats) m.uniforms.uTint.value = amt;
}
/* Solidify (0..1): blendet das Noise-Wabern aus → der diffuse Geist
   erstarrt zur harten Silhouette (Manga-Impact). 1 = komplett solide. */
export function solidify(amt) {
  for (const m of M.mats) m.uniforms.uAmp.value = m.userData.baseAmp * (1 - amt);
}

export function spawnMob(st, isBoss) {
  if (M.group) despawnMobVisual();
  M.group = new THREE.Group();
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const def = isBoss ? BOSSES[Math.min(G.floor - 1, BOSSES.length - 1)] : animal;
  /* Wächter-Modell schon beim Boss-Spawn vorladen → Befreiung ist sofort da */
  if (isBoss && def.model) loadModelOnce(def.model.key, def.model.url, { toon: true });

  /* Schattengeist (Augen zur Kamera via lookAt unten) */
  const fb = animal.fb;
  const baseR = isBoss ? (def.form === 'koenig' ? 2.55 : 2.2) : 1.9;
  M.mat = blobMaterial(isBoss ? def.dark : fb.color, isBoss ? .7 : fb.amp);
  M.mats = [M.mat];
  const hoverY = 2.5;

  if (isBoss) {
    /* Echte Wächter-Silhouette aus mehreren Schatten-Massen statt Kugel */
    const hc = buildBossBody(def.form, baseR);
    /* Merkmale teilen ein eigenes (kaum waberndes) Schatten-Material, das
       MIT erstarrt – scharfe Ohren/Geweih, aber gleicher Solidify/Tint */
    const featMat = blobMaterial(def.dark, .12); M.mats.push(featMat);
    const hr = baseR * (def.form === 'koenig' ? .44 : def.form === 'hirsch' ? .37
      : def.form === 'adler' ? .4 : .5);
    bossFeatures(def.form, M.group, hc, hr, featMat);
    addEyes(M.group, hc.x, hc.y + hr * .12, hc.z + hr * .82, .26, hr * .42, 0xff2e4d);
    const aura = glowSprite(def.aura, 10); aura.material.opacity = .5;
    aura.position.y = 0;
    M.group.add(aura);
  } else {
    /* normaler Schattengeist: kompakte Blob-Kugel */
    const body = new THREE.Mesh(new THREE.SphereGeometry(baseR, 48, 36), M.mat);
    body.scale.y = fb.squash;
    M.group.add(body);
    addEyes(M.group, 0, baseR * .28, baseR * .86, .25, baseR * .38, fb.eye);
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
  M.group = null; M.shadow = null; M.mat = null; M.mats = [];
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
  M.group = null; M.shadow = null; M.mat = null; M.mats = [];
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
  for (const m of M.mats) m.uniforms.uTime.value = time;
  if (M.group && G.mob) {
    const bob = Math.sin(time * 1.6) * .18;
    M.group.position.y = M.group.userData.hoverY + bob;
    /* Schatten liegt fest am Boden; nur dezent kleiner, wenn der Geist
       höher schwebt (wirkt wie echter Wurfschatten) */
    if (M.shadow) M.shadow.scale.setScalar(1 - bob * .35);
  }
}
