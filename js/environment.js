/**
 * environment.js — AAA Cinematic Storyboard Blockout
 * Placeholder geometry mapped to the new Steadicam drone flight path.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

let gltfLoader = null;

function initAssetPipeline() {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
  dracoLoader.preload();

  gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
}

export function loadModel(scene, path, position, scale, rotation) {
  if (!gltfLoader) initAssetPipeline();

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        model.position.copy(position);
        if (scale) model.scale.setScalar(scale);
        if (rotation) model.rotation.set(rotation.x, rotation.y, rotation.z);

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(model);
        resolve(model);
      },
      undefined,
      reject
    );
  });
}

function createMaterials() {
  return {
    darkConcrete: new THREE.MeshStandardMaterial({ color: 0x111115, metalness: 0.1, roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x2a2a35, metalness: 0.8, roughness: 0.4 }),
    accentCyan: new THREE.MeshStandardMaterial({ color: 0x00f3ff, emissive: 0x00f3ff, emissiveIntensity: 2.0 }),
    accentWarm: new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 1.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x000000, transmission: 0.9, opacity: 1, metalness: 0, roughness: 0, ior: 1.5 })
  };
}

export function createEnvironment(scene) {
  initAssetPipeline();
  const mat = createMaterials();

  // Global Ground Plane
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat.darkConcrete);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid
  const grid = new THREE.GridHelper(300, 100, 0x222233, 0x11111a);
  grid.position.y = -0.9;
  scene.add(grid);

  // ── WP1: The Skyline (Camera at 20, 40, 50) ──
  // Distant abstract skyscrapers
  for (let i = 0; i < 20; i++) {
    const h = 20 + Math.random() * 50;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, h, 10), mat.steel);
    mesh.position.set(-50 + Math.random() * 100, h/2 - 1, 80 + Math.random() * 50);
    scene.add(mesh);
  }

  // ── WP2: The Balcony (Camera at 0, 8, 0) ──
  const balconyBase = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 10), mat.darkConcrete);
  balconyBase.position.set(0, 3, -5);
  scene.add(balconyBase);

  const railing = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 0.2), mat.steel);
  railing.position.set(0, 7.5, -9.9);
  scene.add(railing);

  // ── WP3: The Bicycle (Camera at -2, 2, -30) ──
  // Low-poly placeholder for a bike
  const bikeFrame = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.2), mat.accentWarm);
  bikeFrame.position.set(-1, 1, -33);
  bikeFrame.rotation.y = Math.PI / 4;
  scene.add(bikeFrame);

  const wheel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16), mat.steel);
  wheel1.rotation.x = Math.PI / 2;
  wheel1.position.set(-2, 0.8, -32);
  scene.add(wheel1);

  // ── WP4: Rooftop Antenna (Camera at 2, 15, -60) ──
  const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 12, 15), mat.darkConcrete);
  roof.position.set(0, 5, -65);
  scene.add(roof);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 20), mat.steel);
  antenna.position.set(2, 21, -65);
  scene.add(antenna);
  
  const blinker = new THREE.Mesh(new THREE.SphereGeometry(0.4), mat.accentCyan);
  blinker.position.set(2, 31, -65);
  scene.add(blinker);

  // ── WP5: Amphitheater (Camera at 0, 3, -100) ──
  for (let i = 0; i < 5; i++) {
    const radius = 10 + i * 4;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 1, 32, 1, true, 0, Math.PI),
      mat.darkConcrete
    );
    ring.rotation.y = Math.PI;
    ring.position.set(0, i * 1, -110);
    scene.add(ring);
  }

  // ── WP6: Dawn (Camera at 0, 20, -130) ──
  // Large monolith facing the sunrise
  const monolith = new THREE.Mesh(new THREE.BoxGeometry(5, 40, 2), mat.steel);
  monolith.position.set(0, 19, -150);
  scene.add(monolith);
}
