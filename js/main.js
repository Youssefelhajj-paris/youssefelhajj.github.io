/**
 * main.js — AAA Cinematic Entry Point
 */

import { initScene } from './scene.js';
import { createEnvironment } from './environment.js';
import { initScrollController } from './scroll-controller.js';

let mouseX = 0.5;
let mouseY = 0.5;
let parallaxX = 0;
let parallaxY = 0;
const PARALLAX_STRENGTH = 0.5;
const PARALLAX_LERP = 0.05;

let prevTimestamp = 0;
let ambientSound = null;

async function boot() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  // Initialize Rendering
  const { scene, camera, renderer, render } = initScene(canvas);
  
  // Build Placeholder Environment
  createEnvironment(scene);

  // Initialize Scroll & Spline
  const scrollCtrl = initScrollController(camera);

  // Mouse Parallax
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX / window.innerWidth;
    mouseY = e.clientY / window.innerHeight;
  });

  // Setup Ambient Audio (Howler)
  // Electronic drone that crossfades to wind/city ambient on scroll
  // We use placeholder audio URLs as requested
  ambientSound = new Howl({
    src: ['https://assets.codepen.io/16327/drone.mp3'], // Placeholder electronic drone
    loop: true,
    volume: 0.0
  });

  // Start audio on first interaction (browser policy)
  const startAudio = () => {
    if (ambientSound && !ambientSound.playing()) {
      ambientSound.play();
      ambientSound.fade(0, 0.4, 2000);
    }
    document.removeEventListener('click', startAudio);
    document.removeEventListener('scroll', startAudio);
  };
  document.addEventListener('click', startAudio);
  document.addEventListener('scroll', startAudio, { once: true });

  // Render Loop
  function animate(timestamp) {
    requestAnimationFrame(animate);

    if (prevTimestamp === 0) prevTimestamp = timestamp;
    const deltaMs = timestamp - prevTimestamp;
    prevTimestamp = timestamp;

    // Scroll progress (0 to 1)
    const progress = scrollCtrl.update();

    // Mouse Parallax (Additive)
    const targetPX = (mouseX - 0.5) * PARALLAX_STRENGTH;
    const targetPY = (mouseY - 0.5) * -PARALLAX_STRENGTH;
    parallaxX += (targetPX - parallaxX) * PARALLAX_LERP;
    parallaxY += (targetPY - parallaxY) * PARALLAX_LERP;
    camera.position.x += parallaxX;
    camera.position.y += parallaxY;

    // Render Scene (passing delta, progress, and time in seconds)
    render(deltaMs, progress, timestamp * 0.001);
  }

  requestAnimationFrame(animate);
}

boot().catch(console.error);
