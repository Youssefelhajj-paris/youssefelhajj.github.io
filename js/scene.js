/**
 * scene.js — Dynamic Sky Shader, Lighting, EffectComposer
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Procedural Sky Shader mapped to scroll progress
 * Transitions: 0 (Blurred Dark) -> 0.5 (Starry Night) -> 1.0 (5 AM Sunrise with Clouds)
 */
const skyVertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const skyFragmentShader = `
  uniform float u_progress;
  uniform float u_time;
  varying vec3 vWorldPosition;

  // Noise functions for clouds/stars
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
  }
  
  float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p = p * 2.02;
    f += 0.2500 * noise(p); p = p * 2.03;
    f += 0.1250 * noise(p); p = p * 2.01;
    f += 0.0625 * noise(p);
    return f;
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = dir.y; // Height -1 to 1

    // Colors
    vec3 darkSky = vec3(0.02, 0.02, 0.04);
    vec3 nightHorizon = vec3(0.05, 0.06, 0.1);
    
    vec3 dawnSky = vec3(0.1, 0.2, 0.4);
    vec3 dawnHorizon = vec3(0.8, 0.4, 0.2);

    // ── Phase 1: Night ──
    vec3 nightColor = mix(nightHorizon, darkSky, max(h, 0.0));
    
    // Stars
    float starDensity = smoothstep(0.7, 1.0, hash(dir.x * 100.0 + dir.y * 100.0));
    float starIntensity = starDensity * max(0.0, sin(u_time * 2.0 + hash(dir.x)*10.0));
    nightColor += vec3(starIntensity) * smoothstep(0.2, 0.8, u_progress); // Stars fade in

    // ── Phase 2: Dawn ──
    vec3 dawnColor = mix(dawnHorizon, dawnSky, max(h, 0.0));
    
    // Clouds
    float cloudNoise = fbm(dir * 4.0 + vec3(u_time * 0.05, 0.0, u_time * 0.02));
    float cloudAlpha = smoothstep(0.4, 0.7, cloudNoise);
    vec3 cloudColor = mix(vec3(0.2, 0.1, 0.1), vec3(0.9, 0.7, 0.6), h);
    dawnColor = mix(dawnColor, cloudColor, cloudAlpha);

    // ── Blend based on progress ──
    // progress: 0 to 0.7 is night, 0.7 to 1.0 is dawn
    float dawnBlend = smoothstep(0.6, 1.0, u_progress);
    
    vec3 finalColor = mix(nightColor, dawnColor, dawnBlend);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  // ── Dynamic Sky ──
  const skyGeo = new THREE.SphereGeometry(500, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms: {
      u_progress: { value: 0.0 },
      u_time: { value: 0.0 }
    },
    side: THREE.BackSide,
    depthWrite: false
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // ── Dynamic Lighting ──
  const hemiLight = new THREE.HemisphereLight(0x111122, 0x050510, 0.5);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0x556688, 1.0);
  dirLight.position.set(20, 50, -20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  // ── Post-Processing ──
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35, 0.4, 0.85
  );
  composer.addPass(bloomPass);

  // FPS Monitor
  let postProcessingEnabled = true;
  const frameTimes = [];

  function checkPerformance(deltaMs) {
    frameTimes.push(deltaMs);
    if (frameTimes.length > 60) frameTimes.shift();
    if (frameTimes.length === 60) {
      const avgMs = frameTimes.reduce((a, b) => a + b, 0) / 60;
      const avgFPS = 1000 / avgMs;
      if (avgFPS < 45 && postProcessingEnabled) {
        console.warn(`[Scene] FPS dropped to ${avgFPS.toFixed(1)}, disabling bloom`);
        postProcessingEnabled = false;
      }
    }
  }

  function updateLighting(progress) {
    skyMat.uniforms.u_progress.value = progress;
    
    // Night -> Dawn transition
    const dawnBlend = Math.max(0, (progress - 0.6) / 0.4);
    
    hemiLight.color.lerpColors(new THREE.Color(0x111122), new THREE.Color(0x443333), dawnBlend);
    hemiLight.groundColor.lerpColors(new THREE.Color(0x050510), new THREE.Color(0x111122), dawnBlend);
    
    dirLight.color.lerpColors(new THREE.Color(0x556688), new THREE.Color(0xffcc88), dawnBlend);
    dirLight.intensity = 1.0 + dawnBlend * 1.5;
  }

  function render(deltaMs, progress, time) {
    checkPerformance(deltaMs);
    skyMat.uniforms.u_time.value = time;
    updateLighting(progress);

    if (postProcessingEnabled) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  }

  window.addEventListener('resize', onResize);

  return { scene, camera, renderer, render };
}
