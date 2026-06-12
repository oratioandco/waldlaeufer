/* =====================================================================
   SICHTBARER BEGLEITER – das erste befreite Tier fliegt fortan
   neben dem Waldläufer her (Story-Payoff, statt Third-Person-Avatar).
   Eigene GLTF-Instanz (unabhängig von den Befreiungs-Reveals).
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from '../engine/renderer.js';
import { camPos, camFocus } from '../engine/camera.js';
import { G } from '../state.js';
import { ANIMALS } from './data.js';
import { prepModel, pickClip } from './models.js';
import { glowSprite } from '../engine/textures.js';
import { auraColor } from '../meta/cosmetics.js';

let grp = null, mixer = null, loadedKey = null, loading = false;
let aura = null, auraHex = null;

/* Tauschplatz-Aura: Glühen um den Begleiter (an-/ablegbar) */
function syncAura() {
  const want = auraColor();
  if (!grp) return;
  if (want === auraHex) return;
  if (aura) { grp.remove(aura); aura = null; }
  if (want !== null) {
    aura = glowSprite(want, 3.2);
    aura.material.opacity = .5;
    grp.add(aura);
  }
  auraHex = want;
}

function ensureCompanion() {
  if (!G.companion) return;
  if (loadedKey === G.companion.key || loading) return;
  loading = true;
  const animal = ANIMALS.find(a => a.key === G.companion.key);
  if (!animal) { loading = false; return; }
  new GLTFLoader().load(animal.url, g => {
    if (grp) { scene.remove(grp); if (mixer) mixer.stopAllAction(); }
    grp = new THREE.Group();
    prepModel(g.scene, { toon: animal.toon });
    g.scene.scale.setScalar(animal.scale * .38); /* klein – Begleiter, kein Hauptdarsteller */
    grp.add(g.scene);
    mixer = null;
    if (g.animations.length) {
      mixer = new THREE.AnimationMixer(g.scene);
      /* Begleiter trabt mit → Gallop; Vögel haben nur ihren Flug-Clip */
      mixer.clipAction(pickClip(g.animations, 'Gallop', 'Walk')).play();
    }
    grp.position.copy(camPos).add(new THREE.Vector3(2, -1, -3));
    scene.add(grp);
    loadedKey = animal.key;
    loading = false;
  }, undefined, () => { loading = false; });
}

const dir = new THREE.Vector3(), right = new THREE.Vector3(), target = new THREE.Vector3();
export function updateCompanion(dt, time) {
  ensureCompanion();
  if (!grp) return;
  syncAura();
  if (mixer) mixer.update(dt);
  /* Position: rechts neben der Kamera, leicht voraus, unterhalb des
     Blicks – mit weichem Nachziehen (fühlt sich lebendig an) */
  dir.copy(camFocus).sub(camPos).setY(0).normalize();
  right.set(-dir.z, 0, dir.x);
  target.copy(camPos).addScaledVector(right, 3.6).addScaledVector(dir, 6.5);
  target.y = camPos.y - 1.0 + Math.sin(time * 2.1) * .18;
  grp.position.lerp(target, Math.min(1, dt * 2.2));
  /* Front (+z) in Bewegungsrichtung */
  target.copy(grp.position).add(dir);
  grp.lookAt(target);
}
