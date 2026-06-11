/* =====================================================================
   RENDERER + POST (Bloom/ACES)
   Portiert von Three.js r128: ColorManagement aus + lineare Ausgabe +
   Lichtintensitäten ×π stellen den r128-Look unter aktuellem Three wieder
   her (seit r155 physikalisches Lichtmodell, seit r152 Color Management).
   ===================================================================== */
import * as THREE from 'three';
import { QUALITY, qTier, effectivePR } from './quality.js';

THREE.ColorManagement.enabled = false;

export let scene = null, camera = null, renderer = null, sun = null, sunTarget = null, hemi = null;
export let raycaster = null, pointer = null;

let rtScene = null, rtA = null, rtB = null, postCam = null, postScene = null, postQuad = null;
let brightMat = null, blurMat = null, compMat = null;

export function initRenderer() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd4f5);
  scene.fog = new THREE.Fog(0xcfe9fb, 36, 100);

  camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, .1, 180);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(effectivePR());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  hemi = new THREE.HemisphereLight(0xcfe6ff, 0x77995a, .85 * Math.PI);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff1cf, 1.35 * Math.PI);
  sun.position.set(24, 36, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 2; sun.shadow.camera.far = 110;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  sunTarget = new THREE.Object3D(); scene.add(sunTarget);
  sun.target = sunTarget;

  raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    setupRT();
  });

  setupPost();
}

/* ---------- Post ---------- */
function setupPost() {
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene = new THREE.Scene();
  brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform sampler2D tDiffuse;
      void main(){
        vec3 c=texture2D(tDiffuse,vUv).rgb;
        float l=dot(c,vec3(0.299,0.587,0.114));
        gl_FragColor=vec4(c*smoothstep(0.72,0.95,l),1.0);
      }`});
  blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform sampler2D tDiffuse;uniform vec2 uDir;uniform vec2 uRes;
      void main(){
        vec2 px=uDir/uRes;
        vec3 c=texture2D(tDiffuse,vUv).rgb*0.227;
        c+=texture2D(tDiffuse,vUv+px*1.384).rgb*0.316;
        c+=texture2D(tDiffuse,vUv-px*1.384).rgb*0.316;
        c+=texture2D(tDiffuse,vUv+px*3.230).rgb*0.070;
        c+=texture2D(tDiffuse,vUv-px*3.230).rgb*0.070;
        gl_FragColor=vec4(c,1.0);
      }`});
  compMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 1 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform sampler2D tScene;uniform sampler2D tBloom;uniform float uBloom;
      vec3 aces(vec3 x){
        return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);
      }
      void main(){
        vec3 c=texture2D(tScene,vUv).rgb;
        c+=texture2D(tBloom,vUv).rgb*0.85*uBloom;
        c=aces(c*1.05);
        float d=distance(vUv,vec2(0.5));
        c*=1.0-smoothstep(0.55,0.95,d)*0.32;
        gl_FragColor=vec4(c,1.0);
      }`});
  postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat);
  postScene.add(postQuad);
  setupRT();
}
export function setupRT() {
  if (!renderer || !blurMat) return;
  const pr = effectivePR();
  const w = Math.max(2, Math.floor(innerWidth * pr)), h = Math.max(2, Math.floor(innerHeight * pr));
  if (rtScene) rtScene.dispose(); if (rtA) rtA.dispose(); if (rtB) rtB.dispose();
  rtScene = new THREE.WebGLRenderTarget(w, h);
  rtA = new THREE.WebGLRenderTarget(w >> 2, h >> 2);
  rtB = new THREE.WebGLRenderTarget(w >> 2, h >> 2);
  blurMat.uniforms.uRes.value.set(w >> 2, h >> 2);
}
export function renderFrame() {
  const useBloom = QUALITY[qTier].bloom;
  if (useBloom) {
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    postQuad.material = brightMat; brightMat.uniforms.tDiffuse.value = rtScene.texture;
    renderer.setRenderTarget(rtA); renderer.render(postScene, postCam);
    postQuad.material = blurMat; blurMat.uniforms.tDiffuse.value = rtA.texture;
    blurMat.uniforms.uDir.value.set(1, 0);
    renderer.setRenderTarget(rtB); renderer.render(postScene, postCam);
    blurMat.uniforms.tDiffuse.value = rtB.texture;
    blurMat.uniforms.uDir.value.set(0, 1);
    renderer.setRenderTarget(rtA); renderer.render(postScene, postCam);
    postQuad.material = compMat;
    compMat.uniforms.tScene.value = rtScene.texture;
    compMat.uniforms.tBloom.value = rtA.texture;
    compMat.uniforms.uBloom.value = 1;
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  } else {
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    postQuad.material = compMat;
    compMat.uniforms.tScene.value = rtScene.texture;
    compMat.uniforms.tBloom.value = rtScene.texture;
    compMat.uniforms.uBloom.value = 0;
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
}
