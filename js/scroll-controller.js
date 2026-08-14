/**
 * scroll-controller.js — Steadicam Drone Spline, Intro Text Physics, Modals
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════
// CINEMATIC DRONE SPLINE (Massive Sweeping Arc)
// ═══════════════════════════════════════════════════
const PATH_POINTS = [
  new THREE.Vector3(20, 40, 50),     // WP1: High altitude, looking at skyline
  new THREE.Vector3(10, 15, 20),     // Diving down
  new THREE.Vector3(0, 8, 0),        // WP2: Balcony level
  new THREE.Vector3(-5, 4, -15),     // Sweeping left
  new THREE.Vector3(-2, 2, -30),     // WP3: Bicycle level (low to ground)
  new THREE.Vector3(5, 10, -45),     // Pulling up, sweeping right
  new THREE.Vector3(2, 15, -60),     // WP4: Rooftop Antenna
  new THREE.Vector3(-8, 5, -80),     // Diving down into open space
  new THREE.Vector3(0, 3, -100),     // WP5: Amphitheater
  new THREE.Vector3(0, 20, -130)     // WP6: Dawn, tilting up into sky
];

const LOOK_POINTS = [
  new THREE.Vector3(0, 10, 0),
  new THREE.Vector3(0, 8, -10),
  new THREE.Vector3(0, 4, -20),
  new THREE.Vector3(-2, 2, -35),
  new THREE.Vector3(0, 5, -50),
  new THREE.Vector3(0, 12, -65),
  new THREE.Vector3(-5, 3, -85),
  new THREE.Vector3(0, 3, -110),
  new THREE.Vector3(0, 20, -140),
  new THREE.Vector3(0, 50, -150)
];

const cameraPath = new THREE.CatmullRomCurve3(PATH_POINTS, false, 'catmullrom', 0.5);
const lookPath   = new THREE.CatmullRomCurve3(LOOK_POINTS, false, 'catmullrom', 0.5);

// ═══════════════════════════════════════════════════
// OVERLAYS & STATE
// ═══════════════════════════════════════════════════
const OVERLAY_RANGES = [
  { id: '#wp1', fadeIn: 0.00, peak: 0.00, fadeOut: 0.05, end: 0.08 },
  { id: '#wp2', fadeIn: 0.15, peak: 0.20, fadeOut: 0.25, end: 0.28 },
  { id: '#wp3', fadeIn: 0.35, peak: 0.40, fadeOut: 0.45, end: 0.48 },
  { id: '#wp4', fadeIn: 0.55, peak: 0.60, fadeOut: 0.65, end: 0.68 },
  { id: '#wp5', fadeIn: 0.75, peak: 0.80, fadeOut: 0.85, end: 0.88 },
  { id: '#wp6', fadeIn: 0.92, peak: 0.96, fadeOut: 1.00, end: 1.00 },
];

let targetProgress = 0;
let smoothProgress = 0;
const LERP_SPEED = 0.03; // Extremely smooth momentum

let scrollTriggerInstance = null;
let isModalOpen = false;

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
export function initScrollController(camera) {
  gsap.registerPlugin(ScrollTrigger, TextPlugin);

  scrollTriggerInstance = ScrollTrigger.create({
    trigger: '#scroll-content',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      if (!isModalOpen) {
        targetProgress = self.progress;
      }
    }
  });

  // Setup Intro Text Scramble Physics
  setupIntroAnimation();
  setupModals();

  return {
    update: () => updateCamera(camera),
    getProgress: () => smoothProgress
  };
}

// ═══════════════════════════════════════════════════
// INTRO ANIMATION
// ═══════════════════════════════════════════════════
function setupIntroAnimation() {
  const introTitle = document.getElementById('intro-title');
  if (!introTitle) return;

  // On first scroll tick, scramble, scale, and blur
  ScrollTrigger.create({
    trigger: '#scroll-content',
    start: 'top top',
    end: '2% top',
    scrub: true,
    animation: gsap.to(introTitle, {
      duration: 1,
      scale: 1.5,
      filter: 'blur(10px)',
      opacity: 0,
      text: {
        value: "010101010101",
        delimiter: "",
        speed: 2
      }
    })
  });
}

// ═══════════════════════════════════════════════════
// MODAL LOGIC (Pause Scroll & Blur)
// ═══════════════════════════════════════════════════
function setupModals() {
  // We use placeholder audio URLs as requested. 
  // In a production build, point these to real assets.
  const uiSound = new Howl({
    src: ['https://assets.codepen.io/16327/click.mp3'], // Placeholder UI click
    volume: 0.5
  });

  const canvasContainer = document.getElementById('canvas-container');

  document.querySelectorAll('.open-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute('data-modal');
      const modal = document.getElementById(modalId);
      
      if (modal) {
        isModalOpen = true;
        // The scroll listener stops updating targetProgress. 
        // We also want to visually freeze or just disable scrolling:
        document.body.style.overflow = 'hidden'; 
        
        canvasContainer.classList.add('blurred');
        modal.classList.add('active');
        uiSound.play();
      }
    });
  });

  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = btn.closest('.modal-container');
      if (modal) {
        isModalOpen = false;
        document.body.style.overflow = '';
        
        canvasContainer.classList.remove('blurred');
        modal.classList.remove('active');
        uiSound.play();
      }
    });
  });
}

// ═══════════════════════════════════════════════════
// CAMERA UPDATE
// ═══════════════════════════════════════════════════
const _cameraPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

function updateCamera(camera) {
  if (isModalOpen) return smoothProgress; // Freeze camera update completely when modal is open

  smoothProgress += (targetProgress - smoothProgress) * LERP_SPEED;
  const t = Math.max(0, Math.min(smoothProgress, 0.9999));

  cameraPath.getPointAt(t, _cameraPos);
  camera.position.copy(_cameraPos);

  lookPath.getPointAt(t, _lookTarget);
  camera.lookAt(_lookTarget);

  updateOverlays(smoothProgress);

  const progressFill = document.getElementById('progress-fill');
  if (progressFill) progressFill.style.width = `${smoothProgress * 100}%`;

  return smoothProgress;
}

function updateOverlays(progress) {
  for (const wp of OVERLAY_RANGES) {
    const el = document.querySelector(wp.id);
    if (!el) continue;

    let opacity = 0;
    if (progress >= wp.fadeIn && progress < wp.peak) {
      opacity = (progress - wp.fadeIn) / (wp.peak - wp.fadeIn);
    } else if (progress >= wp.peak && progress < wp.fadeOut) {
      opacity = 1;
    } else if (progress >= wp.fadeOut && progress < wp.end) {
      opacity = 1 - (progress - wp.fadeOut) / (wp.end - wp.fadeOut);
    }

    el.style.opacity = Math.max(0, Math.min(1, opacity));
    el.style.pointerEvents = opacity > 0.5 && !isModalOpen ? 'auto' : 'none';

    // Slide up effect
    const slide = (1 - opacity) * 30;
    el.style.transform = (el.id === 'wp1' || el.id === 'wp6') 
      ? `translate(-50%, calc(-50% + ${slide}px))` 
      : `translateY(${slide}px)`;
  }
}
