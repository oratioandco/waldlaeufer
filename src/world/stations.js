/* =====================================================================
   PFAD & STATIONEN – mit Sichtkorridor
   Gebietsplanung, Segment-/Stations-Aufbau, Reise-Logik.
   ===================================================================== */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rigPos, rigFocus } from '../engine/camera.js';
import { addAnim, easeInOut } from '../engine/anims.js';
import { QUALITY, qTier, applyQuality } from '../engine/quality.js';
import { glowSprite } from '../engine/textures.js';
import { G } from '../state.js';
import { hash3, hillH, distToClear, setClearArea, groundCenter, reshapeGround, setGroundPalette } from './terrain.js';
import { scatterGrass, setGrassColors } from './grass.js';
import { makeTree, makeBush, makeStone, makeFlowerPatch, makeBigFlower, extraDecor, COLORS, setParticleStyle, pickTreeKey, buildForest } from './vegetation.js';
import { biomeFor } from './biomes.js';
import { spawnMob } from '../creatures/mob.js';
import { BOSSES } from '../creatures/data.js';
import { startWordChallenge } from '../challenges/spell.js';
import { startChest } from '../challenges/blitz.js';
import { startBefehl } from '../challenges/befehl.js';
import { announce } from '../ui/feedback.js';
import { showFloorClear } from '../ui/overlays.js';
import { sndStep } from '../audio/sfx.js';
import { sayGame } from '../audio/tts.js';
import { saveActive } from '../meta/save.js';
import { setAtmosphere, rebuildFloorFx } from './atmosphere.js';
import { playScene } from '../story/scenes.js';
import { bossIntroScene } from '../story/content.js';
import { setAmbienceProgress, setCreek, setBossAura } from '../audio/ambience.js';
import { playBossMusic } from '../audio/music.js';
import { toonMat } from '../engine/materials.js';

let pathHeading = Math.PI;
let pathEnd = new THREE.Vector3(0, 0, 6);
let worldGroups = [];
let biome = biomeFor(1);
let waterMats = [];
let lastSegOfFloor = null; /* fürs Gras: Anschluss-Stück des Vorgebiets */
let forestNearAcc = [], forestFarAcc = [];

/* Lebendiges Bach-Wasser: FLIESSENDE Wellen (scrollend), sanfte
   Vertex-Dünung, weißer Uferschaum – weiterhin iPad-billig */
function makeWaterMat() {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv;uniform float uTime;
      void main(){
        vUv=uv;
        vec3 p=position;
        /* sanfte Dünung quer zur Fließrichtung */
        p.z+=sin(uv.x*22.0-uTime*2.0)*0.06+sin(uv.y*9.0+uTime*1.3)*0.04;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `varying vec2 vUv;uniform float uTime;
      void main(){
        /* Wasser FLIESST: Wellenbänder scrollen entlang des Bachs */
        float flow=vUv.x*30.0-uTime*1.4;
        float w1=sin(flow)*0.5+0.5;
        float w2=sin(flow*0.53+vUv.y*14.0-uTime*0.9)*0.5+0.5;
        float w3=sin(vUv.x*11.0+uTime*0.7)*0.5+0.5;
        float spark=smoothstep(0.78,0.98,w1*w2);
        vec3 deep=vec3(0.13,0.37,0.60);
        vec3 shal=vec3(0.34,0.64,0.84);
        vec3 c=mix(deep,shal,0.2+0.55*mix(w2,w3,0.5));
        c+=vec3(0.92,0.98,1.0)*spark*0.5;
        /* Uferschaum an beiden Rändern, leicht wabernd */
        float edge=min(vUv.y,1.0-vUv.y);
        float foamLine=0.085+0.025*sin(vUv.x*40.0+uTime*1.8);
        float foam=1.0-smoothstep(0.0,foamLine,edge);
        c=mix(c,vec3(0.96,0.99,1.0),foam*0.85);
        gl_FragColor=vec4(c,0.94);
      }`
  });
  waterMats.push(m);
  return m;
}
export function updateWater(time) {
  waterMats.forEach(m => { m.uniforms.uTime.value = time; });
}

/* ---------- Weg-Optik: getretene Erde statt platter Rechtecke ----------
   Eine geteilte RGBA-Textur (Erd-Sprenkel + Kiesel), zu den Längs-
   rändern weich UND wellig ausgefranst → der Weg verschmilzt mit dem
   Gras statt als harte Kante zu enden. Material-Farbe tönt sie aufs
   Biom. iPad-billig: ein Canvas, eine Textur, geteilt. */
let pathTex = null;
function pathTexture() {
  if (pathTex) return pathTex;
  const W = 64, H = 128;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#efe6d0'; ctx.fillRect(0, 0, W, H); /* helle Basis → Tönung schlägt durch */
  /* getretene Erd-Flecken */
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = 1 + Math.random() * 3.2;
    ctx.fillStyle = `rgba(${90 + Math.random() * 45 | 0},${68 + Math.random() * 32 | 0},${44 + Math.random() * 28 | 0},${.08 + Math.random() * .16})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .7, Math.random() * 3, 0, 7); ctx.fill();
  }
  /* ein paar Kiesel */
  for (let i = 0; i < 11; i++) {
    const x = 10 + Math.random() * (W - 20), y = Math.random() * H, r = 1.3 + Math.random() * 1.7;
    ctx.fillStyle = 'rgba(150,152,150,.45)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .8, 0, 0, 7); ctx.fill();
  }
  /* Alpha zu den Längsrändern weich + wellig ausblenden */
  const img = ctx.getImageData(0, 0, W, H), a = img.data;
  for (let y = 0; y < H; y++) {
    const wob = .80 + .20 * Math.sin(y * .23) + .10 * Math.sin(y * .77 + 1.3); /* wellige Kante */
    for (let x = 0; x < W; x++) {
      const d = Math.min(x, W - 1 - x) / 11; /* 0 am Rand … 1 ab 11px innen */
      const al = Math.max(0, Math.min(1, Math.min(1, d) * wob));
      a[(y * W + x) * 4 + 3] = Math.round(al * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  pathTex = new THREE.CanvasTexture(cv);
  pathTex.wrapS = THREE.ClampToEdgeWrapping; /* Ränder bleiben gefedert */
  pathTex.wrapT = THREE.RepeatWrapping;       /* Länge kachelt */
  pathTex.anisotropy = 4;
  return pathTex;
}
/* Radial gefederte Erd-Scheibe für Kreuzungen (kaschiert spitze Nähte) */
let discTex = null;
function discTexture() {
  if (discTex) return discTex;
  const S = 96, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#efe6d0'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 1 + Math.random() * 3;
    ctx.fillStyle = `rgba(${90 + Math.random() * 45 | 0},${68 + Math.random() * 32 | 0},${44 + Math.random() * 28 | 0},${.08 + Math.random() * .15})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .7, 0, 0, 7); ctx.fill();
  }
  const img = ctx.getImageData(0, 0, S, S), a = img.data, c = S / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - c, dy = y - c, dist = Math.sqrt(dx * dx + dy * dy) / c;
    const wob = 1 + .12 * Math.sin(Math.atan2(dy, dx) * 5);
    const al = 1 - Math.min(1, Math.max(0, (dist * wob - .45) / .55));
    a[(y * S + x) * 4 + 3] = Math.round(Math.max(0, Math.min(1, al)) * 255);
  }
  ctx.putImageData(img, 0, 0);
  discTex = new THREE.CanvasTexture(cv);
  return discTex;
}
function junctionPatch(pos) {
  const m = toonMat({ color: biome.path, map: discTexture(), transparent: true });
  m.depthWrite = false;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 22), m);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(pos.x, .026, pos.z); /* knapp unter dem Weg → Weg-Spuren liegen oben */
  disc.receiveShadow = true;
  return disc;
}

export function lateral(dir) { return new THREE.Vector3(-dir.z, 0, dir.x); }

/* Spielstart: Route beginnt wieder direkt vor der Kamera (die
   Titel-Kulisse hat pathEnd sonst schon weit weggeschoben) */
export function resetPath() {
  pathHeading = Math.PI;
  pathEnd = new THREE.Vector3(0, 0, 6);
}

export function planFloor() {
  /* Unbesuchte Stationen des Vorgebiets entsorgen – sie sind nie in
     worldGroups gelandet und blieben sonst als Geister-Dekor stehen */
  G.stations.forEach(st => {
    if (!worldGroups.includes(st.group)) disposeGroup(st.group);
  });
  biome = biomeFor(G.floor);
  waterMats = []; /* alte Bach-Materialien werden mit ihren Gruppen entsorgt */
  setGrassColors(biome.grassA, biome.grassB);
  setGroundPalette(biome.ground);
  setParticleStyle(biome.particle);
  const plan = ['MOB', Math.random() < .5 ? 'TOR' : 'TRUHE', 'MOB', 'BEFEHL',
                'MOB', Math.random() < .5 ? 'TRUHE' : 'TOR', 'BOSS'];
  G.stations = []; G.stIdx = -1;
  const newSegs = []; const newStations = [];
  let first = true;
  plan.forEach((type) => {
    /* erstes Segment: sanfter Knick + lang → raus aus der alten Lichtung */
    pathHeading += first ? (Math.random() - .5) * .5 : (Math.random() - .5) * .85;
    const dir = new THREE.Vector3(Math.sin(pathHeading), 0, Math.cos(pathHeading));
    const dist = first ? 24 : (type === 'BOSS' ? 20 : 15 + Math.random() * 4);
    first = false;
    const pos = pathEnd.clone().addScaledVector(dir, dist);
    newSegs.push({ a: pathEnd.clone(), b: pos.clone() });
    const st = { type, pos, dir, done: false, group: new THREE.Group(), objs: {}, from: pathEnd.clone() };
    scene.add(st.group);
    pathEnd = pos.clone();
    newStations.push(st);
  });
  /* Sichtkorridor: aktuelle Segmente + Stationslichtungen */
  setClearArea(newSegs, newStations.map(s => s.pos.clone()));
  G.stations = newStations;

  /* ALTES Dekor in Korridornähe entfernen (kann den Blick verstellen) */
  worldGroups.forEach(g => {
    [...g.children].forEach(ch => {
      if (ch.position && distToClear(ch.position.x, ch.position.z) < 11) g.remove(ch);
    });
  });

  groundCenter.set(0, 0, 0);
  G.stations.forEach(s => groundCenter.add(s.pos));
  groundCenter.multiplyScalar(1 / G.stations.length);
  reshapeGround();
  /* Gras AUCH um das letzte Stück des Vorgebiets streuen – sonst
     verschwindet es schlagartig um den Spieler, der noch in der
     alten Boss-Lichtung steht (sichtbarer Glitch) */
  scatterGrass(lastSegOfFloor ? [lastSegOfFloor, ...newSegs] : newSegs);
  lastSegOfFloor = newSegs[newSegs.length - 1];
  applyQuality();
  forestNearAcc = []; forestFarAcc = [];
  G.stations.forEach(st => { buildSegment(st, st.from); buildStation(st); });
  buildForest(forestNearAcc, forestFarAcc, biome, QUALITY[qTier].extras);
  rebuildFloorFx(newSegs, G.stations);
  setAtmosphere(0, G.floor); /* neues Gebiet beginnt am Morgen */
  renderDots();
}

function decorY(x, z) { return hillH(x, z); }

/* Mindestabstände je Objekttyp – Bäume haben breite Kronen.
   Großzügiger als zuvor: NICHTS soll den Weg oder die Sicht verdecken. */
function placeOK(p, type) {
  const need = type === 'tree' ? 10.5 : (type === 'bush' ? 7 : 5.5);
  return distToClear(p.x, p.z) >= need;
}

function freezeStatic(obj, shadows) {
  obj.traverse(o => {
    if (o.isMesh) o.castShadow = shadows;
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
}

function buildSegment(st, from) {
  const dir = st.pos.clone().sub(from).normalize();
  const lat = lateral(dir);
  const len = st.pos.distanceTo(from);
  const seed = Math.floor(st.pos.x * 7 + st.pos.z * 13);

  /* getretener Erdweg mit gefederten, welligen Rändern (kein Rechteck) */
  const pathGeo = new THREE.PlaneGeometry(3.4, len + 4);
  const uv = pathGeo.attributes.uv;
  const tiles = (len + 4) / 4.2; /* ~4 m pro Kachel → Textur wiederholt sich der Länge nach */
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * tiles);
  const pathMat = toonMat({ color: biome.path, map: pathTexture(), transparent: true });
  pathMat.alphaTest = .02;
  const path = new THREE.Mesh(pathGeo, pathMat);
  path.rotation.x = -Math.PI / 2;
  const mid = from.clone().add(st.pos).multiplyScalar(.5);
  path.position.set(mid.x, .03, mid.z);
  path.rotation.z = Math.atan2(dir.x, dir.z);
  path.receiveShadow = true;
  st.group.add(path);
  /* Kreuzungs-Flicken am Ziel der Strecke: kaschiert die spitze Naht,
     wo das nächste Segment in einem Winkel anschließt */
  st.group.add(junctionPatch(st.pos));
  if (st.type !== 'BOSS') st.group.add(junctionPatch(from)); /* Anschluss rückwärts */

  for (let d = 2; d < len - 2; d += 2.6) {
    [-1, 1].forEach(side => {
      const r1 = hash3(seed, d, side);
      if (r1 < .15) return;
      const off = 5 + hash3(seed, d + 1, side) * 12;
      const p = from.clone().addScaledVector(dir, d).addScaledVector(lat, side * off);
      let obj, type;
      /* Biom-Dichten verschieben die Auswahl-Schwellen */
      const treeT = .15 + (.6 - .15) * biome.treeDensity;
      const bushT = treeT + .17 * biome.bushDensity;
      if (r1 < treeT) { obj = makeTree(seed + d * 3 + side, biome); type = 'tree'; }
      else if (r1 < bushT) { obj = makeBush(seed + d * 5 + side, biome); type = 'bush'; }
      else if (r1 < bushT + .13) { obj = makeStone(seed + d * 7 + side, biome); type = 'stone'; }
      else { obj = makeFlowerPatch(seed + d * 9 + side); type = 'flower'; }
      if (!placeOK(p, type)) return; /* SICHTKORRIDOR */
      const isExtra = hash3(seed, d + 4, side) < .4;
      obj.position.set(p.x, decorY(p.x, p.z), p.z);
      obj.rotation.y = hash3(seed, d, side * 3) * 6.28;
      if (isExtra) { obj.visible = QUALITY[qTier].extras; extraDecor.push(obj); }
      st.group.add(obj);
    });
  }

  /* TIEFENSTAFFELUNG: hinter der ersten Baumreihe steht WALD,
     nicht leerer Boden. Als INSTANZEN gesammelt (Draw Calls!):
     Reihe 2 (15-30m) immer, Reihe 3 (30-48m) ab Qualitaet MITTEL. */
  const E = new THREE.Euler(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const place = (arr, pos, rotY, sc, seedK) => {
    const key = pickTreeKey(seedK, biome);
    if (!key) return;
    E.set(0, rotY, 0); Q.setFromEuler(E); S.set(sc, sc, sc); P.set(pos.x, decorY(pos.x, pos.z), pos.z);
    arr.push({ key, matrix: new THREE.Matrix4().compose(P.clone(), Q.clone(), S.clone()) });
  };
  for (let d = 1; d < len - 1; d += 2.0) {
    [-1, 1].forEach(side => {
      const r2 = hash3(seed, d * 1.7 + 40, side);
      if (r2 < .32) return;
      const off = 15 + hash3(seed, d + 41, side) * 15;
      const p = from.clone().addScaledVector(dir, d).addScaledVector(lat, side * off);
      place(forestNearAcc, p, hash3(seed, d, side * 5) * 6.28, .95 + hash3(seed, d, side + 9) * .5, seed + d * 13 + side * 7);
    });
    [-1, 1].forEach(side => {
      const r3 = hash3(seed, d * 2.3 + 80, side);
      if (r3 < .35) return;
      const off = 30 + hash3(seed, d + 81, side) * 18;
      const p = from.clone().addScaledVector(dir, d).addScaledVector(lat, side * off);
      place(forestFarAcc, p, hash3(seed, d, side * 6) * 6.28, 1.25 + hash3(seed, d, side + 13) * .55, seed + d * 19 + side * 11);
    });
  }
}

function buildStation(st) {
  const lat = lateral(st.dir);
  const seed = Math.floor(st.pos.x * 3 + st.pos.z * 5);
  if (st.type === 'MOB') {
    /* Baum-Faecher HINTER der Begegnung: die Szene bekommt einen Raum.
       Weiter draußen (14 m) + Korridor-Check, damit kein Baum auf einer
       benachbarten Strecke landet und die Sicht verstellt. */
    for (let i = 0; i < 5; i++) {
      const a = (-.5 + i / 4) * 1.5;
      const tp = st.pos.clone()
        .addScaledVector(st.dir, Math.cos(a) * 14)
        .addScaledVector(lat, Math.sin(a) * 14);
      if (distToClear(tp.x, tp.z) < 9) continue;
      const tr = makeTree(seed + i * 17 + 5, biome);
      tr.scale.multiplyScalar(1.15 + hash3(seed, i, 2) * .4);
      tr.position.set(tp.x, decorY(tp.x, tp.z), tp.z);
      tr.rotation.y = hash3(seed, i, 3) * 6.28;
      freezeStatic(tr, true);
      st.group.add(tr);
    }
  }
  if (st.type === 'TOR') {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.6, 32, 6), makeWaterMat());
    water.rotation.x = -Math.PI / 2;
    water.position.set(st.pos.x, .05, st.pos.z);
    water.rotation.z = Math.atan2(st.dir.x, st.dir.z);
    st.group.add(water);
    for (let k = 0; k < 6; k++) {
      const s = makeStone(seed + k, biome);
      const side = k % 2 ? 1 : -1;
      const sp = st.pos.clone()
        .addScaledVector(lat, side * (5 + hash3(seed, k, 1) * 6))
        .addScaledVector(st.dir, (hash3(seed, k, 2) - .5) * 3);
      s.position.set(sp.x, decorY(sp.x, sp.z) + .25, sp.z);
      st.group.add(s);
    }
    st.objs.planks = [];
    for (let k = 0; k < 5; k++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, .22, .9),
        toonMat({ color: 0x8a5f33 }));
      plank.castShadow = true;
      plank.position.copy(st.pos).addScaledVector(st.dir, (k - 2) * 1.0);
      plank.position.y = -.8;
      plank.rotation.y = Math.atan2(st.dir.x, st.dir.z);
      st.group.add(plank);
      st.objs.planks.push(plank);
    }
  }
  if (st.type === 'TRUHE') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1, 1.1),
      toonMat({ color: 0x7a5328 }));
    body.position.copy(st.pos); body.position.y = .5;
    body.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, .45, 1.1),
      toonMat({ color: 0x96672f }));
    lid.position.set(0, .72, 0); lid.castShadow = true; body.add(lid);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .12),
      toonMat({ color: 0xffd34a, emissive: 0xb8860b }));
    lock.position.set(0, .2, .62); body.add(lock);
    body.lookAt(st.pos.clone().sub(st.dir));
    st.group.add(body);
    const gl = glowSprite(0xffe9a3, 3); gl.position.set(st.pos.x, 1, st.pos.z); gl.material.opacity = .5;
    st.group.add(gl);
    st.objs.chest = body; st.objs.lid = lid;
  }
  if (st.type === 'BEFEHL') {
    const pick = [...COLORS].sort(() => Math.random() - .5).slice(0, 3);
    st.objs.colors = pick; st.objs.flowers = [];
    pick.forEach((c, i) => {
      const fl = makeBigFlower(c, seed + i * 9);
      fl.scale.setScalar(1.25);
      fl.position.copy(st.pos).addScaledVector(lat, (i - 1) * 3.8);
      fl.userData.color = c;
      st.group.add(fl);
      st.objs.flowers.push(fl);
    });
  }
  if (st.type === 'BOSS') {
    /* Baumring weiter draußen + Lücke in Laufrichtung */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tp = new THREE.Vector3(st.pos.x + Math.cos(a) * 14, 0, st.pos.z + Math.sin(a) * 14);
      if (distToClear(tp.x, tp.z) < 9) continue;
      const tr = makeTree(seed + i * 11, biome);
      tr.scale.setScalar(1.35 + hash3(seed, i, 1) * .5);
      tr.position.set(tp.x, decorY(tp.x, tp.z), tp.z);
      st.group.add(tr);
    }
  }
}

/* Komplette Alt-Welt räumen (Dev-Gebietssprung) */
export function clearWorldGroups() {
  worldGroups.forEach(disposeGroup);
  worldGroups = [];
}
function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
    const ix = extraDecor.indexOf(o);
    if (ix >= 0) extraDecor.splice(ix, 1);
  });
  scene.remove(g);
}

/* ---------- Reise ---------- */
export function advance() {
  if (G.sandbox) return; /* Dev-Sandbox: keine Reise/Encounter */
  G.stIdx++;
  renderDots();
  if (G.stIdx >= G.stations.length) return;
  const st = G.stations[G.stIdx];
  worldGroups.push(st.group);
  while (worldGroups.length > 9) { disposeGroup(worldGroups.shift()); }

  /* Tageszeit schreitet mit der Reise voran: Boss = Dämmerung */
  const progress = G.stIdx / Math.max(1, G.stations.length - 1);
  setAtmosphere(progress, G.floor);
  setAmbienceProgress(progress);
  setCreek(false); setBossAura(false); /* stationsgebundene Klänge enden beim Aufbruch */

  /* Mehr Abstand: der Geist soll die Silbenkarten nie verdecken
     (Boss noch weiter, sonst füllt der große Geist den Schirm) */
  const standoff = st.type === 'BOSS' ? -14 : -10.4;
  const targetRig = st.pos.clone().addScaledVector(st.dir, standoff); targetRig.y = 3.7;
  const targetFocus = st.pos.clone(); targetFocus.y = 2.2;
  const fromRig = rigPos.clone(), fromFocus = rigFocus.clone();
  const dist = fromRig.distanceTo(targetRig);
  const dur = Math.max(1.3, dist / 9);
  G.state = 'travel'; G.busy = true;
  document.getElementById('mobBar').classList.remove('on');
  let t = 0, stepT = 0;
  addAnim({ update(dt) {
    t += dt / dur; stepT += dt;
    if (stepT > .42) { stepT = 0; sndStep(); }
    const k = easeInOut(Math.min(1, t));
    rigPos.lerpVectors(fromRig, targetRig, k);
    rigFocus.lerpVectors(fromFocus, targetFocus, k);
    rigPos.y = 3.7 + Math.sin(t * dur * 5.2) * .1;
    if (t >= 1) { arrive(st); return true; }
    return false;
  } });
}

function arrive(st) {
  G.state = 'encounter';
  if (st.type === 'MOB') { spawnMob(st, false); setTimeout(() => startWordChallenge('spell'), 800); }
  else if (st.type === 'BOSS') {
    spawnMob(st, true);
    setBossAura(true);
    playBossMusic(G.floor);
    /* Boss stellt sich vor (vorgelesen), dann beginnt der Kampf */
    setTimeout(() => playScene(bossIntroScene(G.floor), () => startWordChallenge('spell')), 1000);
  }
  else if (st.type === 'TOR') { setCreek(true); announce('DER BACH!', 900); sayGame('Ein Bach! Zaubere das Wort, dann wächst die Brücke.'); setTimeout(() => startWordChallenge('gate'), 800); }
  else if (st.type === 'TRUHE') { setTimeout(startChest, 500); }
  else if (st.type === 'BEFEHL') { setTimeout(() => startBefehl(st), 500); }
}
export function stationDone() {
  const st = G.stations[G.stIdx];
  st.done = true; renderDots();
  if (st.type === 'BOSS') {
    const tr = BOSSES[Math.min(G.floor - 1, BOSSES.length - 1)].trophy;
    G.trophies.push(tr);
    setTimeout(showFloorClear, 1100);
  } else {
    setTimeout(advance, 750);
  }
  saveActive();
}
export function renderDots() {
  const el = document.getElementById('progDots');
  el.innerHTML = G.stations.map((s, i) =>
    `<span class="${s.done ? 'done' : ''}">${i <= G.stIdx && !s.done ? '◆' : '●'}</span>`).join('');
}
