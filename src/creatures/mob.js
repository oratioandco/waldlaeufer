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
import { scene, renderer } from '../engine/renderer.js';
import { rigPos } from '../engine/camera.js';
import { addAnim, easeOut, easeInOut } from '../engine/anims.js';
import { glowSprite, blobShadow } from '../engine/textures.js';
import { GLSL_NOISE } from '../world/terrain.js';
import { G } from '../state.js';
import { ANIMALS, BOSSES } from './data.js';
import { MODELS, loadModelOnce, pickClip } from './models.js';
import { sndGrowl } from '../audio/sfx.js';
import { announce } from '../ui/feedback.js';

/* ======================================================================
   WÄCHTER ALS GESTALT AUS DUNKLEM NEBEL
   Kein Stapel aus Grundkörpern mehr: Der Boss ist eine VOLUMETRISCHE
   Rauch-/Nebelwolke (GPU-animierte Punktwolke). Die Kreatur entsteht aus
   der FORM des Nebels + ein paar Wisp-Strähnen (Ohren/Geweih/Schwingen)
   und den leuchtenden Augen. Das prozedurale Wabern ist der Shader.
   ====================================================================== */

/* Nebel-Material: weiche Rauchpartikel (Points). Gleiche Uniform-Namen wie
   das Blob-Material → flashModel/tintRage/solidify/updateMob wirken 1:1.
   solidify (uAmp→0) lässt den Nebel zur dichteren, schärferen Gestalt
   ERSTARREN (Manga-Hieb). */
function mistMaterial(colorHex, swirl) {
  const dpr = (renderer && renderer.getPixelRatio) ? renderer.getPixelRatio() : 1;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {
      uTime: { value: 0 }, uAmp: { value: swirl }, uBaseAmp: { value: swirl },
      uColor: { value: new THREE.Color(colorHex) }, uFlash: { value: 0 },
      uTint: { value: 0 }, uDpr: { value: dpr }
    },
    vertexShader: `
      uniform float uTime;uniform float uAmp;uniform float uBaseAmp;uniform float uDpr;
      attribute float aSeed;attribute float aSize;
      varying float vSolid;
      ${GLSL_NOISE}
      void main(){
        float solid=clamp(1.0-uAmp/max(uBaseAmp,0.001),0.0,1.0);
        vSolid=solid;
        vec3 p=position;
        float t=uTime;
        vec3 q=position*0.55+vec3(aSeed,t*0.16,t*0.11);
        vec3 n=vec3(fbm(q),fbm(q+vec3(11.0,3.0,7.0)),fbm(q+vec3(5.0,9.0,1.0)))-0.5;
        p+=n*uAmp;                                  /* roiling Rauch */
        p.y+=sin(t*0.6+aSeed)*uAmp*0.35;            /* langsames Heben */
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        gl_PointSize=aSize*(0.95+0.45*solid)*uDpr*(330.0/-mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;uniform float uFlash;uniform float uTint;
      varying float vSolid;
      void main(){
        float d=length(gl_PointCoord-0.5);
        float edge=mix(0.46,0.18,vSolid);          /* solid → härtere Kante */
        float a=smoothstep(0.5,0.5-edge,d);
        if(a<0.02)discard;
        a*=mix(0.42,0.68,vSolid);                  /* dichter Rauch (sichtbar!) */
        vec3 col=uColor*0.4;                        /* dunkler Nebel (fast schwarz) */
        col=mix(col,vec3(1.0,0.12,0.16),uTint*0.6);
        col=mix(col,vec3(1.0),uFlash);
        gl_FragColor=vec4(col,a);
      }`
  });
  m.userData.baseAmp = swirl;
  return m;
}

/* Form-Sampler: liefert Rauchpunkte (Hüllform je Wächter) + Kopfposition.
   blob = gefüllte Ellipsoid-Wolke (zentrumsbetont); wisp = ausgefranste
   Strähne (Ohren/Geweih/Schwingen/Schweif). +z = zur Kamera, +y = oben. */
function sampleWraith(form, R) {
  const P = [];
  const D = 2.0; /* Dichte-Faktor: genug Überlappung für einen dichten Nebelkern */
  const blob = (cx, cy, cz, rx, ry, rz, n0, sz) => {
    const n = Math.round(n0 * D);
    for (let i = 0; i < n; i++) {
      let x, y, z, l;
      do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1);
      const b = Math.sqrt(Math.random());                       /* Zentrum dichter */
      P.push({ x: cx + x * rx * b, y: cy + y * ry * b, z: cz + z * rz * b, s: sz * (0.6 + 0.9 * Math.random()) });
    }
  };
  const wisp = (x0, y0, z0, x1, y1, z1, n0, sz, jit) => {
    const n = Math.round(n0 * D);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      P.push({
        x: x0 + (x1 - x0) * t + (Math.random() - 0.5) * jit,
        y: y0 + (y1 - y0) * t + (Math.random() - 0.5) * jit,
        z: z0 + (z1 - z0) * t + (Math.random() - 0.5) * jit,
        s: sz * (0.6 + 0.6 * Math.random()) * (1.0 - 0.22 * t)  /* zur Spitze etwas feiner */
      });
    }
  };
  const sym = (fn) => { fn(1); fn(-1); };
  let head;
  if (form === 'wolf') {
    /* schlankes Raubtier mit hohen, dichten Spitzohren */
    blob(0, .4 * R, 0, .46 * R, .62 * R, .48 * R, 30, .52);
    blob(0, 1.0 * R, .16 * R, .38 * R, .4 * R, .42 * R, 18, .48);
    wisp(0, .12 * R, 0, 0, -1.05 * R, 0, 16, .44, .16 * R);            /* Rauchschweif */
    sym(s => wisp(s * .3 * R, 1.2 * R, 0, s * .52 * R, 2.25 * R, -.06 * R, 16, .46, .07 * R)); /* hohe Spitzohren */
    wisp(0, .86 * R, .5 * R, 0, .74 * R, 1.05 * R, 8, .4, .07 * R);    /* Schnauze */
    head = { x: 0, y: .98 * R, z: .42 * R };
  } else if (form === 'fuchs') {
    /* KLEIN, aber mit riesigen, dominanten Lauschern */
    blob(0, .34 * R, 0, .34 * R, .44 * R, .36 * R, 16, .42);
    blob(0, .82 * R, .14 * R, .28 * R, .3 * R, .36 * R, 12, .42);
    wisp(0, .08 * R, 0, 0, -.9 * R, 0, 12, .34, .13 * R);
    sym(s => wisp(s * .3 * R, .95 * R, 0, s * .78 * R, 2.85 * R, -.04 * R, 22, .5, .07 * R)); /* RIESIGE Ohren */
    wisp(0, .74 * R, .42 * R, 0, .64 * R, 1.1 * R, 8, .34, .06 * R);   /* spitze Schnauze */
    head = { x: 0, y: .8 * R, z: .42 * R };
  } else if (form === 'baerin') {
    /* MASSIG & breit – der Größenkontrast ist die Signatur */
    blob(0, .34 * R, 0, .82 * R, .8 * R, .74 * R, 60, .62);            /* riesiger Rumpf */
    blob(0, 1.04 * R, .08 * R, .58 * R, .52 * R, .56 * R, 36, .58);    /* breiter Kopf */
    wisp(0, 0, 0, 0, -.95 * R, 0, 16, .5, .26 * R);
    sym(s => blob(s * .56 * R, 1.42 * R, 0, .2 * R, .2 * R, .2 * R, 9, .44)); /* runde Ohren */
    blob(0, .86 * R, .56 * R, .34 * R, .26 * R, .26 * R, 16, .46);     /* breite Schnauze */
    head = { x: 0, y: 1.04 * R, z: .54 * R };
  } else if (form === 'adler') {
    /* schmaler Körper, WEIT gespannte dichte Schwingen (Signatur) */
    blob(0, .46 * R, 0, .32 * R, .66 * R, .32 * R, 18, .42);
    blob(0, 1.06 * R, .1 * R, .3 * R, .3 * R, .32 * R, 12, .4);
    wisp(0, .14 * R, 0, 0, -.85 * R, 0, 12, .34, .1 * R);              /* Schwanzfedern */
    sym(s => {                                                          /* große Schwingen */
      wisp(s * .18 * R, .62 * R, -.04 * R, s * 1.85 * R, .9 * R, -.18 * R, 28, .54, .12 * R);
      wisp(s * .18 * R, .4 * R, -.04 * R, s * 1.6 * R, -.05 * R, -.18 * R, 22, .48, .12 * R);
    });
    wisp(0, .98 * R, .42 * R, 0, .88 * R, 1.08 * R, 6, .3, .05 * R);    /* Hakenschnabel */
    head = { x: 0, y: 1.05 * R, z: .4 * R };
  } else if (form === 'hirsch') {
    /* hoch & schlank, GROSSES weit verzweigtes Geweih (Signatur) */
    blob(0, .28 * R, 0, .34 * R, .58 * R, .38 * R, 20, .44);
    wisp(0, -.05 * R, 0, 0, -.95 * R, 0, 12, .34, .1 * R);
    blob(0, .82 * R, .12 * R, .2 * R, .44 * R, .22 * R, 12, .36);      /* langer Hals */
    blob(0, 1.32 * R, .16 * R, .24 * R, .28 * R, .32 * R, 12, .4);
    sym(s => {                                                          /* weit gespreiztes Geweih */
      wisp(s * .18 * R, 1.55 * R, -.04 * R, s * .8 * R, 3.25 * R, -.08 * R, 24, .44, .07 * R);  /* Hauptstange */
      wisp(s * .46 * R, 2.4 * R, -.04 * R, s * 1.3 * R, 3.0 * R, -.08 * R, 14, .38, .06 * R);   /* Spross 1 */
      wisp(s * .62 * R, 2.78 * R, -.04 * R, s * .45 * R, 3.7 * R, -.08 * R, 12, .36, .05 * R);  /* Spross 2 */
    });
    wisp(0, 1.22 * R, .4 * R, 0, 1.1 * R, 1.05 * R, 6, .3, .05 * R);    /* Schnauze */
    head = { x: 0, y: 1.28 * R, z: .4 * R };
  } else { /* koenig */
    /* hoch aufragend, breite Schultern, gezackte Krone, erhobene Arme */
    blob(0, .3 * R, 0, .6 * R, .8 * R, .55 * R, 44, .56);              /* Umhang-Torso */
    blob(0, .94 * R, 0, .78 * R, .42 * R, .54 * R, 32, .54);           /* breite Schultern */
    wisp(0, -.1 * R, 0, 0, -1.1 * R, 0, 18, .5, .22 * R);              /* Umhang-Wisp */
    blob(0, 1.38 * R, .04 * R, .36 * R, .42 * R, .38 * R, 18, .46);
    for (let i = 0; i < 8; i++) {                                       /* gezackte Krone */
      const a = (i / 8) * Math.PI * 2, tall = (i % 2 === 0) ? 1.15 : .6;
      wisp(Math.cos(a) * .52 * R, 1.66 * R, Math.sin(a) * .42 * R + .06 * R,
        Math.cos(a) * .58 * R, (1.66 + tall) * R, Math.sin(a) * .46 * R + .06 * R, 7, .34, .04 * R);
    }
    sym(s => wisp(s * .6 * R, .8 * R, .12 * R, s * 1.12 * R, .05 * R, .24 * R, 16, .42, .09 * R)); /* erhobene Arme */
    head = { x: 0, y: 1.38 * R, z: .38 * R };
  }
  return { P, head };
}

/* Baut die Nebelwolke (eine THREE.Points-Wolke, M.mat = Nebel-Material).
   Liefert die Kopfposition für die leuchtenden Augen. */
function buildMistWraith(def, R) {
  const { P, head } = sampleWraith(def.form, R);
  const N = P.length;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = P[i].x; pos[i * 3 + 1] = P[i].y; pos[i * 3 + 2] = P[i].z;
    seed[i] = Math.random() * 6.2832; size[i] = P[i].s * R;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  M.mat = mistMaterial(def.dark, R * .3);
  M.mats = [M.mat];
  const cloud = new THREE.Points(geo, M.mat);
  cloud.frustumCulled = false;
  M.group.add(cloud);
  return head;
}

/* ---------- Leuchtende Schatten-Augen (Kern + additiver Glow) ---------- */
function addGlowEyes(group, cx, cy, cz, r, spread, color) {
  [-1, 1].forEach(sx => {
    const core = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10),
      new THREE.MeshBasicMaterial({ color, depthTest: false }));
    core.position.set(cx + sx * spread, cy, cz); core.renderOrder = 12;
    group.add(core);
    const glow = glowSprite(color, r * 4); glow.material.opacity = .8;
    glow.position.copy(core.position); glow.renderOrder = 11;
    group.add(glow);
  });
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
  /* Größenkontrast je Wächter (Bärin/König groß, Fuchs klein) → distinkter */
  const BR = { wolf: 2.2, fuchs: 1.85, baerin: 2.55, adler: 2.15, hirsch: 2.3, koenig: 2.6 };
  const baseR = isBoss ? (BR[def.form] || 2.2) : 1.9;
  M.mat = blobMaterial(isBoss ? def.dark : fb.color, isBoss ? .7 : fb.amp);
  M.mats = [M.mat];
  const hoverY = 2.5;

  if (isBoss) {
    /* Wächter = Gestalt aus dunklem Nebel (volumetrische Punktwolke) */
    const head = buildMistWraith(def, baseR);
    addGlowEyes(M.group, head.x, head.y, head.z, baseR * .12, baseR * .2, 0xff4d63);
    /* dezenter farbiger Energie-Schimmer im Kern (je Wächter) */
    const aura = glowSprite(def.aura, baseR * 1.7); aura.material.opacity = .3;
    aura.position.y = baseR * .5;
    M.group.add(aura);
  } else {
    /* normaler Schattengeist: kompakte Blob-Kugel */
    const body = new THREE.Mesh(new THREE.SphereGeometry(baseR, 48, 36), M.mat);
    body.scale.y = fb.squash;
    M.group.add(body);
    addGlowEyes(M.group, 0, baseR * .28, baseR * .86, .22, baseR * .38, fb.eye);
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
