/**
 * scroll-controller.js
 * Handles the Dual-Mode Toggle and the advanced Waypoint Camera Path.
 * Solves the "pixel crash" by explicitly dispersing blocks out of frame 
 * as the camera flies past them.
 */

gsap.registerPlugin(ScrollTrigger);

const body = document.body;
const modeToggle = document.getElementById('modeToggle');
const world = document.getElementById('world');
const proxy = document.getElementById('scroll-proxy');
let stInstance = null; // ScrollTrigger instance

// --- Mode Toggle Logic ---
modeToggle.addEventListener('click', () => {
    if (body.classList.contains('mode-2d')) {
        // Switch to 3D Spatial Mode
        body.classList.replace('mode-2d', 'mode-3d');
        modeToggle.textContent = '[ DISABLE 3D SPATIAL MODE ]';
        window.scrollTo(0, 0);
        init3DPath();
    } else {
        // Switch to 2D Standard Mode
        body.classList.replace('mode-3d', 'mode-2d');
        modeToggle.textContent = '[ ENABLE 3D SPATIAL MODE ]';
        destroy3DPath();
    }
});

// --- Advanced Waypoint Camera Path & Professional Mechanics ---
function init3DPath() {
    // 1. Position the sections deep in Z space
    gsap.set('#hero', { z: 0 });
    gsap.set('#about', { z: -3000 });
    gsap.set('#work', { z: -6000 });
    gsap.set('#ventures', { z: -9000 });
    gsap.set('#contact', { z: -12000 });

    // 2. Initial Setup for all animated blocks
    // Hero starts assembled. Everything else starts exploded backwards.
    const allSections = ['#about', '#work', '#ventures', '#contact'];
    gsap.set('#hero .block-animate', { opacity: 1, scale: 1, z: 0, rotationX: 0 });
    
    allSections.forEach(sec => {
        gsap.set(`${sec} .block-animate`, { opacity: 0, scale: 0.5, z: -800, rotationX: 10 });
    });

    // 3. Build the Master Waypoint Timeline
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: proxy,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.5 // Smooth tracking
        }
    });

    // ============================================
    // STEP 1: LEAVE HERO, FLY TO ABOUT (Z: 0 -> 3000)
    // ============================================
    tl.to(world, { z: 3000, x: 400, ease: "power1.inOut", duration: 3 }, 0);
    
    // Disperse Hero out of frame *before* hitting it
    tl.to('#hero .block-animate', { opacity: 0, scale: 2, z: 500, duration: 1.5, ease: "power2.in" }, 0.5);
    
    // Assemble About blocks as we arrive
    tl.to('#about .block-animate', { opacity: 1, scale: 1, z: 0, rotationX: 0, duration: 1.5, stagger: 0.1, ease: "power2.out" }, 1.5);

    // ============================================
    // STEP 2: PAUSE & PAN AT ABOUT
    // ============================================
    let t = tl.duration();
    tl.to(world, { z: 3000, duration: 0.8 }, t); // Pause on Bio Text
    tl.to(world, { x: -400, ease: "power2.inOut", duration: 2 }, t + 0.8); // Pan to Portrait Image
    tl.to(world, { z: 3000, duration: 0.8 }, t + 2.8); // Pause on Portrait Image

    // ============================================
    // STEP 3: LEAVE ABOUT, FLY TO WORK (Z: 3000 -> 6000)
    // ============================================
    t = tl.duration();
    tl.to(world, { z: 6000, x: 400, y: -100, ease: "power1.inOut", duration: 3 }, t);
    
    // Disperse About out of frame
    tl.to('#about .block-animate', { opacity: 0, scale: 2, z: 500, duration: 1.5, ease: "power2.in" }, t + 0.5);
    
    // Assemble Work
    tl.to('#work .block-animate', { opacity: 1, scale: 1, z: 0, rotationX: 0, duration: 1.5, stagger: 0.1, ease: "power2.out" }, t + 1.5);

    // ============================================
    // STEP 4: PAUSE & PAN AT WORK
    // ============================================
    t = tl.duration();
    tl.to(world, { z: 6000, duration: 0.8 }, t); // Pause on Custom Allocator
    tl.to(world, { x: -400, ease: "power1.inOut", duration: 2.5 }, t + 0.8); // Pan smoothly across grid
    tl.to(world, { z: 6000, duration: 0.8 }, t + 3.3); // Pause at end of grid

    // ============================================
    // STEP 5: LEAVE WORK, FLY TO VENTURES (Z: 6000 -> 9000)
    // ============================================
    t = tl.duration();
    tl.to(world, { z: 9000, x: 400, y: 0, ease: "power1.inOut", duration: 3 }, t);
    
    // Disperse Work
    tl.to('#work .block-animate', { opacity: 0, scale: 2, z: 500, duration: 1.5, ease: "power2.in" }, t + 0.5);
    
    // Assemble Ventures
    tl.to('#ventures .block-animate', { opacity: 1, scale: 1, z: 0, rotationX: 0, duration: 1.5, stagger: 0.1, ease: "power2.out" }, t + 1.5);

    // ============================================
    // STEP 6: PAUSE & PAN AT VENTURES
    // ============================================
    t = tl.duration();
    tl.to(world, { z: 9000, duration: 0.8 }, t); // Pause on Swipply Text
    tl.to(world, { x: -400, ease: "power2.inOut", duration: 2 }, t + 0.8); // Pan to Presentation Images
    tl.to(world, { z: 9000, duration: 0.8 }, t + 2.8); // Pause on Images

    // ============================================
    // STEP 7: LEAVE VENTURES, FLY TO CONTACT (Z: 9000 -> 12000)
    // ============================================
    t = tl.duration();
    tl.to(world, { z: 12000, x: 0, y: 0, ease: "power2.inOut", duration: 3 }, t);
    
    // Disperse Ventures
    tl.to('#ventures .block-animate', { opacity: 0, scale: 2, z: 500, duration: 1.5, ease: "power2.in" }, t + 0.5);
    
    // Assemble Contact
    tl.to('#contact .block-animate', { opacity: 1, scale: 1, z: 0, rotationX: 0, duration: 1.5, stagger: 0.1, ease: "power2.out" }, t + 1.5);

    // Linger on Contact
    t = tl.duration();
    tl.to(world, { z: 12000, duration: 2 }, t); // extra space to scroll at the bottom

    stInstance = tl.scrollTrigger;

    // Optional: AST Scrambler Triggers
    // Using a simple interval to trigger them when they become visible (opacity > 0)
    const eyebrows = document.querySelectorAll('[data-scramble]');
    const interval = setInterval(() => {
        if (!body.classList.contains('mode-3d')) {
            clearInterval(interval);
            return;
        }
        eyebrows.forEach(eye => {
            const block = eye.closest('.block-animate');
            if (block && window.getComputedStyle(block).opacity > 0.5) {
                if (!eye.hasAttribute('data-parsed')) {
                    eye.setAttribute('data-parsed', 'true');
                    if(window.ASTParser) new window.ASTParser(eye).play(eye.getAttribute('data-scramble'), { duration: 1000, minReveal: 200 });
                }
            } else {
                eye.removeAttribute('data-parsed');
            }
        });
    }, 500);
}

function destroy3DPath() {
    // Kill all scroll triggers
    ScrollTrigger.getAll().forEach(t => t.kill());
    stInstance = null;

    // Reset all transforms so 2D flow works naturally
    gsap.set(world, { clearProps: "all" });
    const sections = ['#hero', '#about', '#work', '#ventures', '#contact'];
    sections.forEach(id => {
        gsap.set(id, { clearProps: "all" });
        const blocks = document.querySelector(id).querySelectorAll('.block-animate');
        gsap.set(blocks, { clearProps: "all", opacity: 1, scale: 1 }); // ensure visible in 2D
    });
}

// Ensure 2D elements are visible on load
document.querySelectorAll('.block-animate').forEach(el => el.style.opacity = '1');
