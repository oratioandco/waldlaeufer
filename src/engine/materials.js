/* =====================================================================
   ART DIRECTION „KNUDDEL-LOWPOLY"
   Ein Material für die ganze Welt: MeshToon mit weicher Verlaufs-
   Rampe (Half-Lambert-Gefühl) statt hartem Lambert-Terminator.
   Kostet wie Lambert – läuft auf alten iPads – sieht nach
   Oceanhorn/Kawaii aus. Konsistenz ist der Look.
   ===================================================================== */
import * as THREE from 'three';

let ramp = null;
function gradientRamp() {
  if (ramp) return ramp;
  /* 5 Stufen, weich gefiltert → sanfter Verlauf mit Toon-Charakter,
     Schattenseite bleibt freundlich hell (nie „dreckig dunkel") */
  const steps = [92, 148, 198, 238, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { data.set([v, v, v, 255], i * 4); });
  ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.LinearFilter;
  ramp.needsUpdate = true;
  return ramp;
}

export function toonMat(opts = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: gradientRamp(), ...opts });
}
