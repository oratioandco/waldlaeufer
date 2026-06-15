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
  if (form === 'wolf') {
    /* große aufrechte Spitzohren + lange Raubtier-Schnauze */
    [-1, 1].forEach(s => put(cone(hr * .42, hr * 1.7), s * hr * .52, hr * .98, -hr * .12, s * .12, 0, s * -.3));
    put(cone(hr * .42, hr * 1.6), 0, -hr * .4, hr * .72, Math.PI / 2.25, 0, 0); /* lange Schnauze, leicht gesenkt */
  } else if (form === 'fuchs') {
    /* RIESIGE spitze Lauscher (Fuchs-Signatur) + schmale spitze Schnauze */
    [-1, 1].forEach(s => put(cone(hr * .5, hr * 2.4), s * hr * .62, hr * 1.25, -hr * .1, s * .14, 0, s * -.42));
    put(cone(hr * .3, hr * 1.8), 0, -hr * .36, hr * .8, Math.PI / 2.2, 0, 0);
  } else if (form === 'baerin') {
    /* kleine runde Ohren + breite stumpfe Schnauze mit Nase */
    [-1, 1].forEach(s => put(ball(hr * .4), s * hr * .82, hr * .84, -hr * .04));
    put(ball(hr * .62), 0, -hr * .26, hr * .82);
    put(ball(hr * .28), 0, -hr * .44, hr * 1.18);
  } else if (form === 'adler') {
    /* scharfer Hakenschnabel + Brauenfedern */
    put(cone(hr * .34, hr * 1.4), 0, -hr * .28, hr * .82, Math.PI / 2.35, 0, 0);
    put(ball(hr * .18), 0, -hr * .12, hr * 1.05); /* Schnabelwurzel */
    [-1, 1].forEach(s => put(cone(hr * .2, hr * .8), s * hr * .5, hr * .72, -hr * .05, 0, 0, s * -.22));
  } else if (form === 'hirsch') {
    /* lange Schnauze + GROSSES verzweigtes Schatten-Geweih (Signatur) */
    put(cone(hr * .4, hr * 1.6), 0, -hr * .32, hr * .85, Math.PI / 2.25, 0, 0);
    [-1, 1].forEach(s => {
      put(cyl(hr * .14, hr * .2, hr * 2.7), s * hr * .42, hr * 1.75, -hr * .1, 0, 0, s * .34);   /* Hauptstange */
      put(cyl(hr * .09, hr * .13, hr * 1.5), s * hr * 1.12, hr * 2.7, -hr * .1, 0, 0, s * 1.0);   /* Spross 1 */
      put(cyl(hr * .09, hr * .13, hr * 1.35), s * hr * .5, hr * 3.15, -hr * .1, 0, 0, s * -.3);    /* Spross 2 */
      put(cyl(hr * .08, hr * .11, hr * 1.05), s * hr * 1.55, hr * 3.5, -hr * .1, 0, 0, s * .72);   /* Spross 3 */
    });
  } else if (form === 'koenig') {
    /* hohe, gezackte Dornenkrone (abwechselnd lang/kurz) */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tall = (i % 2 === 0) ? 1.6 : 1.0;
      put(cone(hr * .2, hr * tall), Math.cos(a) * hr * .8, hr * 1.0, Math.sin(a) * hr * .8 + hr * .1);
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
  /* Rauch-Schweif: nach unten spitz zulaufender Kegel → der Körper läuft als
     Geist in Wisps aus, statt mit einem runden „Schneemann"-Boden zu enden.
     topY innerhalb des Körpers, damit die Basis-Scheibe verdeckt bleibt. */
  const tail = (topR, topY, len, sx = 1, sz = 1) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(topR, len, 18), M.mat);
    c.position.set(0, topY - len * .5, 0); c.rotation.x = Math.PI; c.scale.set(sx, 1, sz); grp.add(c); return c;
  };
  /* WICHTIG: Kamera blickt FRONTAL → Silhouette in der BILD-Ebene lesbar
     machen (Kopf oben, Merkmale seitlich breit). Körper = EINE fließende
     Tropfen-/Geistform (Massen stark überlappt, unten als Rauch auslaufend),
     kein Stapel sichtbar getrennter Kugeln. Proportionen je Wächter eigen. */
  let hc;
  if (form === 'wolf') {
    /* schlankes, geducktes Raubtier, Kopf vorgestreckt */
    mass(R * .56, 0, .34 * R, .04 * R, .8, 1.14, .96);   /* schlanker Rumpf */
    tail(R * .48, .04 * R, R * 1.05, .8, .92);           /* Rauchschweif */
    hc = new THREE.Vector3(0, 1.04 * R, .26 * R);
    mass(R * .38, hc.x, hc.y, hc.z, 1.0, .8, 1.28);      /* länglicher Kopf */
  } else if (form === 'fuchs') {
    /* klein & schlank – die riesigen Ohren dominieren */
    mass(R * .46, 0, .32 * R, .04 * R, .72, 1.06, .84);  /* kleiner Rumpf */
    tail(R * .4, .04 * R, R * .95, .72, .85);
    hc = new THREE.Vector3(0, .94 * R, .24 * R);
    mass(R * .32, hc.x, hc.y, hc.z, .95, .8, 1.28);      /* spitzer Kopf */
  } else if (form === 'baerin') {
    /* massig, breit, gedrungen */
    mass(R * .82, 0, .18 * R, 0, 1.14, 1.04, 1.0);       /* breiter Rumpf */
    mass(R * .6, 0, .66 * R, .06 * R, 1.16, .84, .92);   /* massige Schultern */
    tail(R * .72, -.06 * R, R * .9, 1.06, .96);
    hc = new THREE.Vector3(0, 1.16 * R, .12 * R);
    mass(R * .46, hc.x, hc.y, hc.z, 1.06, .9, 1.06);     /* breiter Kopf */
  } else if (form === 'adler') {
    /* aufrecht & schmal – die Schwingen sind die Silhouette */
    mass(R * .42, 0, .3 * R, 0, .78, 1.28, .82);         /* schmaler Rumpf */
    tail(R * .32, .0 * R, R * .85, .7, .8);              /* Schwanzfedern */
    hc = new THREE.Vector3(0, 1.06 * R, .12 * R);
    mass(R * .36, hc.x, hc.y, hc.z, .96, .98, 1.0);      /* Kopf */
    [-1, 1].forEach(s => {
      [[1.15, .3, 2.8, .02], [.95, -.05, 2.3, -.28]].forEach(([px, py, ln, drop]) => {
        const w = new THREE.Mesh(new THREE.ConeGeometry(R * .5, R * ln, 9), M.mat);
        w.scale.set(1, 1, .13); w.position.set(s * R * px, R * py, -R * .1);
        w.rotation.z = s * (Math.PI / 2.0 + drop); grp.add(w);
      });
    });
  } else if (form === 'hirsch') {
    /* hoch & schlank, langer Hals – das Geweih krönt */
    mass(R * .48, 0, .16 * R, 0, .76, 1.16, .96);        /* schlanker Rumpf */
    tail(R * .4, -.08 * R, R * .95, .72, .85);
    mass(R * .26, 0, .76 * R, .14 * R, .64, 1.18, .7);   /* langer Hals */
    hc = new THREE.Vector3(0, 1.26 * R, .22 * R);
    mass(R * .3, hc.x, hc.y, hc.z, .88, .88, 1.32);      /* langer schmaler Kopf */
  } else { /* koenig */
    /* hoch aufragende, verhüllte Gestalt mit breiten Schultern + Arm-Wisps */
    mass(R * .68, 0, .28 * R, 0, 1.06, 1.18, .92);       /* Umhang-Torso */
    mass(R * .64, 0, .72 * R, 0, 1.2, .78, .86);         /* breite Schultern */
    tail(R * .78, -.05 * R, R * .95, 1.04, .92);         /* langer Umhang-Wisp */
    hc = new THREE.Vector3(0, 1.28 * R, .04 * R);
    mass(R * .4, hc.x, hc.y, hc.z, .92, 1.06, .92);      /* Kopf unter der Krone */
    [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.ConeGeometry(R * .24, R * 1.35, 10), M.mat);
      a.position.set(s * R * .84, R * .52, R * .12); a.rotation.z = s * .55; grp.add(a); }); /* erhobene Arme */
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
    const featMat = blobMaterial(def.dark, .2); M.mats.push(featMat);
    /* Kopfradius je Wächter (passend zu buildBossBody) → Ohren/Augen sitzen */
    const HR = { wolf: .38, fuchs: .32, baerin: .46, adler: .36, hirsch: .3, koenig: .4 };
    const hr = baseR * (HR[def.form] || .4);
    bossFeatures(def.form, M.group, hc, hr, featMat);
    const eyeR = Math.min(.24, hr * .6);
    addEyes(M.group, hc.x, hc.y + hr * .14, hc.z + hr * .86, eyeR, hr * .5, 0xff2e4d);
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
