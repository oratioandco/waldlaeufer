/* ---------- Himmel: Gradient-Kuppel, Sonnen-Sprite, Wolken ---------- */
import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { glowTex } from '../engine/textures.js';
import { camPos } from '../engine/camera.js';
import { hash3 } from './terrain.js';

let clouds = [];

export function buildSky() {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP;
      void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vP;
      void main(){
        float h=normalize(vP).y*0.5+0.5;
        vec3 top=vec3(0.33,0.62,0.94);
        vec3 hor=vec3(0.90,0.96,1.0);
        gl_FragColor=vec4(mix(hor,top,smoothstep(0.42,0.95,h)),1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 16, 12), skyMat);
  sky.userData.followCam = true;
  scene.add(sky); clouds.push(sky);
  const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xfff6d8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sunSp.scale.set(55, 55, 1);
  sunSp.userData.followCamOffset = new THREE.Vector3(70, 80, 35);
  scene.add(sunSp); clouds.push(sunSp);
  for (let i = 0; i < 7; i++) {
    const grp = new THREE.Group();
    const n = 2 + Math.floor(hash3(i, 1, 2) * 3);
    for (let k = 0; k < n; k++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 + hash3(i, k, 3) * 2.6, 1),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: .94 }));
      c.scale.y = .4;
      c.position.set(k * 3.4 - (n * 1.7), hash3(i, k, 4) * 1.2, hash3(i, k, 5) * 2);
      grp.add(c);
    }
    grp.position.set(-80 + hash3(i, 6, 7) * 160, 28 + hash3(i, 8, 9) * 16, -70 + hash3(i, 10, 11) * 70);
    grp.userData.cloudSpeed = .4 + hash3(i, 12, 13) * .7;
    scene.add(grp); clouds.push(grp);
  }
}
export function updateSky(dt) {
  clouds.forEach(c => {
    if (c.userData.followCam) { c.position.copy(camPos); return; }
    if (c.userData.followCamOffset) { c.position.copy(camPos).add(c.userData.followCamOffset); return; }
    c.position.x += c.userData.cloudSpeed * dt;
    if (c.position.x > 100) c.position.x = -100;
  });
}
