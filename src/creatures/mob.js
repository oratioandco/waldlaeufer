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
import { MODELS } from './models.js';
import { sndGrowl } from '../audio/sfx.js';
import { announce } from '../ui/feedback.js';

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

  /* Schattengeist-Blob (Augen zur Kamera via lookAt unten) */
  const fb = animal.fb;
  const baseR = isBoss ? 2.5 : 1.9;
  M.mat = blobMaterial(isBoss ? 0x2a2140 : fb.color, isBoss ? .8 : fb.amp);
  const body = new THREE.Mesh(new THREE.SphereGeometry(baseR, 48, 36), M.mat);
  body.scale.y = isBoss ? 1.15 : fb.squash;
  M.group.add(body);
  [-1, 1].forEach(sx => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(isBoss ? .3 : .25, 12, 10),
      new THREE.MeshBasicMaterial({ color: isBoss ? 0xff2e4d : fb.eye }));
    e.position.set(sx * baseR * .38, baseR * .28, baseR * .86);
    M.group.add(e);
  });
  const hoverY = 2.5;

  if (isBoss) {
    const aura = glowSprite(0x9b59c9, 10); aura.material.opacity = .5;
    aura.position.y = 0;
    M.group.add(aura);
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.font = '190px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 36;
    ctx.fillStyle = '#f3e8ff'; ctx.fillText(def.sym, 128, 140);
    const sym = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sym.scale.set(2.3, 2.3, 1); sym.position.set(0, 1.4, 0);
    M.group.add(sym);
  }
  M.shadow = blobShadow(5);
  M.group.add(M.shadow);

  M.group.userData.hoverY = hoverY;
  M.group.position.copy(st.pos); M.group.position.y = hoverY;
  M.group.lookAt(rigPos.x, hoverY, rigPos.z);
  M.group.scale.setScalar(.001);
  scene.add(M.group);

  const hp = (isBoss ? def.hp : animal.hp) + (G.floor >= 4 ? 20 : 0);
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
  scene.remove(M.group); M.group = null; M.shadow = null; M.mat = null;
}
export function setMobHp() {
  document.getElementById('mobHpFill').style.width = Math.max(0, (G.mob.hp / G.mob.max * 100)) + '%';
}

/* Befreiung: Der Schattengeist löst sich auf – und das befreite Tier
   erscheint und entkommt (Blickrichtung = Bewegungsrichtung). */
export function freeMobVisual() {
  const grp = M.group;
  const animal = G.mob && !G.mob.boss ? G.mob.animal : null;
  M.group = null; M.shadow = null; M.mat = null;
  let t = 0;
  addAnim({ update(dt) {
    t += dt * 4;
    grp.scale.setScalar(Math.max(.001, 1 - t));
    grp.rotation.y += dt * 9;
    if (t >= 1) { scene.remove(grp); return true; }
    return false;
  } });
  if (animal) revealFreedAnimal(animal, grp.position.clone());
}

function revealFreedAnimal(animal, pos) {
  const model = MODELS[animal.key];
  if (!model) return; /* Modell (noch) nicht geladen → nur Auflösungs-Effekt */
  const g = new THREE.Group();
  const ms = model.scene; /* Instanz wird wiederverwendet – nur 1 Befreiung gleichzeitig */
  ms.position.set(0, 0, 0); ms.rotation.set(0, 0, 0);
  ms.scale.setScalar(animal.scale);
  g.add(ms);
  let mix = null;
  if (model.clips.length) {
    mix = new THREE.AnimationMixer(ms);
    const act = mix.clipAction(model.clips[0]);
    act.timeScale = animal.key === 'horse' ? .55 : 1;
    act.play();
  }
  /* Erst dem Spieler zuwenden („Danke"-Moment), dann umdrehen und fliehen */
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
  let t = 0;
  addAnim({ update(dt) {
    t += dt;
    if (mix) mix.update(dt);
    if (t < .4) {
      g.scale.setScalar(easeOut(Math.min(1, t / .4)));
    } else if (t < 1.0) {
      if (!grounded) g.position.y = baseY + Math.sin(t * 3) * .15;
    } else if (t < 1.5) {
      g.rotation.y = yawFace + easeInOut((t - 1.0) / .5) * Math.PI;
    } else {
      g.position.addScaledVector(dir, dt * (grounded ? 7 : 4));
      if (!grounded) g.position.y += dt * 5;
    }
    if (t >= 3.4) { mix && mix.stopAllAction(); g.remove(ms); scene.remove(g); return true; }
    return false;
  } });
}

export function updateMob(time) {
  if (M.mat) M.mat.uniforms.uTime.value = time;
  if (M.group && G.mob) {
    M.group.position.y = M.group.userData.hoverY + Math.sin(time * 1.6) * .18;
    if (M.shadow) M.shadow.position.y = .06 - M.group.position.y;
  }
}
