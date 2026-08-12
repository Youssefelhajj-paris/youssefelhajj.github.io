/**
 * ============================================
 * MATRIX SYMBOL REVEAL — WebGL Shader Engine
 * Fixed Matrix Effect (Slicing Image Fall) + Perfect Timings
 * ============================================
 */

(function () {
  'use strict';

  const CONFIG = {
    IMAGE_SRC: 'assets/images/youssef-elhajj-portrait-full.jpg',
    PORTRAIT_SCALE: 0.85,    
    PORTRAIT_OFFSET_X: 0.65, 
    PORTRAIT_OFFSET_Y: 0.5,
    
    CELL_SIZE_Y: 4.5, 
    CELL_SIZE_X: 2.5, 
    
    CHAR_TILES: ['W', 'M', '@', '8', '&', 'Σ', '{', '}', '+', '=', '<', '>', '/', '\\', '*', ':', '-', '.', ',', ' '],
    TILE_RES_Y: 64,
    TILE_RES_X: 36
  };

  let scene, camera, renderer, material, plane;
  let globalStartTime = 0;
  
  // ── Sprite Sheet Generation ────────────────────────────
  function generateSpriteSheet() {
    const numTiles = CONFIG.CHAR_TILES.length;
    const canvas = document.createElement('canvas');
    canvas.width = numTiles * CONFIG.TILE_RES_X;
    canvas.height = CONFIG.TILE_RES_Y;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < numTiles; i++) {
      const char = CONFIG.CHAR_TILES[i];
      let weight = 500;
      if (i < 6) weight = 800; 
      else if (i > 15) weight = 300; 
      
      ctx.font = `${weight} ${CONFIG.TILE_RES_Y * 0.8}px "JetBrains Mono", monospace`;
      ctx.fillText(char, (i * CONFIG.TILE_RES_X) + (CONFIG.TILE_RES_X / 2), CONFIG.TILE_RES_Y / 2);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  // ── Shaders ────────────────────────────────────────────
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D u_image;
    uniform sampler2D u_sprites;
    uniform float u_time;
    uniform float u_progress; 
    uniform vec2 u_resolution;
    
    uniform vec2 u_imageOffset; 
    uniform vec2 u_imageScale;  
    
    uniform vec2 u_cellSize; 
    uniform float u_tileCount;
    uniform float u_dpr; 
    
    varying vec2 vUv;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec2 grid = (u_resolution / u_cellSize) * u_dpr;
      vec2 cellUV = floor(vUv * grid) / grid;
      
      // Calculate continuous offset for falling matrix streams
      float colRandom = random(vec2(cellUV.x, 0.0));
      float startOffset = 1.0 + colRandom * 1.5; // Starts 1-2.5 screens above
      float ease = 1.0 - pow(1.0 - u_progress, 3.0); // Perfect ease out stop
      float yOffset = startOffset * (1.0 - ease);
      
      // Discretize the fall so the characters step exactly grid by grid
      float stepOffset = floor(yOffset * grid.y) / grid.y;
      
      vec2 offsetCellUV = cellUV;
      // Subtracting stepOffset forces the image slice to start above and fall DOWN
      offsetCellUV.y -= stepOffset;
      
      // 1. DYNAMIC IMAGE MAPPING (No Wrapping)
      vec2 imgUV = (offsetCellUV - u_imageOffset) / u_imageScale;
      vec4 imgColor = vec4(1.0); 
      
      // Strict bounding box stops bottom of image from wrapping to top
      if(imgUV.x >= 0.0 && imgUV.x <= 1.0 && imgUV.y >= 0.0 && imgUV.y <= 1.0) {
          imgColor = texture2D(u_image, imgUV);
      } else {
          discard; // Draw absolutely nothing if it hasn't fallen onto screen yet
      }
      
      float luminance = dot(imgColor.rgb, vec3(0.299, 0.587, 0.114));
      
      // Keep background clean
      if(luminance > 0.95) {
          discard;
      }
      
      // 2. DISCRETE MATRIX RAIN
      float tileIndex = floor(luminance * (u_tileCount - 1.0));
      
      if (u_progress < 1.0) {
          // Add chaotic fluctuation seeded by the falling coordinate
          float charNoise = random(vec2(offsetCellUV.x, offsetCellUV.y));
          if (charNoise > 0.6) {
              tileIndex = floor(random(offsetCellUV + u_time) * (u_tileCount - 1.0));
          }
          // Smoothly lock into the final index as progress completes
          tileIndex = mix(tileIndex, floor(luminance * (u_tileCount - 1.0)), smoothstep(0.5, 1.0, u_progress));
      }
      
      // 3. RENDER
      // Local UV is strictly static to the grid. Characters jump, they don't smear.
      vec2 localUV = fract(vUv * grid);
      vec2 spriteUV = vec2((tileIndex + localUV.x) / u_tileCount, 1.0 - localUV.y);
      vec4 charTex = texture2D(u_sprites, spriteUV);
      
      float charAlpha = 1.0 - charTex.r;
      
      // Apply correct tonal shading to the falling characters
      vec3 darkColor = vec3(0.02, 0.03, 0.05); 
      vec3 lightColor = vec3(0.7, 0.75, 0.8);
      vec3 finalColor = mix(darkColor, lightColor, luminance);
      
      float opacity = smoothstep(1.0, 0.7, luminance);
      
      gl_FragColor = vec4(finalColor, charAlpha * opacity);
    }
  `;

  // ── Setup ──────────────────────────────────────────────
  function initWebGL() {
    const container = document.getElementById('webgl-container');
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const spriteTexture = generateSpriteSheet();
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(CONFIG.IMAGE_SRC, (imageTexture) => {
      const imgAspect = imageTexture.image.width / imageTexture.image.height;
      const screenAspect = window.innerWidth / window.innerHeight;
      
      const scaleY = CONFIG.PORTRAIT_SCALE;
      const scaleX = scaleY * (imgAspect / screenAspect);
      const offsetX = CONFIG.PORTRAIT_OFFSET_X - (scaleX / 2);
      const offsetY = (1.0 - CONFIG.PORTRAIT_OFFSET_Y) - (scaleY / 2);

      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        uniforms: {
          u_image: { value: imageTexture },
          u_sprites: { value: spriteTexture },
          u_time: { value: 0.0 },
          u_progress: { value: 0.0 },
          u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          u_dpr: { value: dpr }, 
          u_cellSize: { value: new THREE.Vector2(CONFIG.CELL_SIZE_X, CONFIG.CELL_SIZE_Y) },
          u_tileCount: { value: CONFIG.CHAR_TILES.length },
          u_imageScale: { value: new THREE.Vector2(scaleX, scaleY) },
          u_imageOffset: { value: new THREE.Vector2(offsetX, offsetY) }
        }
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      window.addEventListener('resize', onResize);
      
      globalStartTime = performance.now();
      requestAnimationFrame(animate);
    });
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (material) {
      material.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
      const imgAspect = material.uniforms.u_image.value.image.width / material.uniforms.u_image.value.image.height;
      const screenAspect = window.innerWidth / window.innerHeight;
      const scaleY = CONFIG.PORTRAIT_SCALE;
      const scaleX = scaleY * (imgAspect / screenAspect);
      const offsetX = CONFIG.PORTRAIT_OFFSET_X - (scaleX / 2);
      const offsetY = (1.0 - CONFIG.PORTRAIT_OFFSET_Y) - (scaleY / 2);
      material.uniforms.u_imageScale.value.set(scaleX, scaleY);
      material.uniforms.u_imageOffset.value.set(offsetX, offsetY);
    }
  }

  // ── Animation Loop ─────────────────────────────────────
  function animate(time) {
    requestAnimationFrame(animate);
    
    const elapsed = (time - globalStartTime) / 1000.0;
    
    // Exactly 3 seconds for the entire animation
    let progress = Math.min(elapsed / 3.0, 1.0);
    
    if (material) {
      material.uniforms.u_time.value = elapsed;
      material.uniforms.u_progress.value = progress;
    }
    
    renderer.render(scene, camera);
  }

  // ── Background Streams ─────────────────────────────────
  function initStreams() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]<>/\\=+-*&|;:%$#@!';
    const getRandStr = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    
    document.querySelector('.stream-1').innerText = getRandStr(80);
    document.querySelector('.stream-2').innerText = getRandStr(120);
    document.querySelector('.stream-3').innerText = getRandStr(90);
    document.querySelector('.stream-4').innerText = getRandStr(100);

    setInterval(() => {
      document.querySelectorAll('.stream').forEach(stream => {
        let text = stream.innerText;
        const idx = Math.floor(Math.random() * text.length);
        text = text.substring(0, idx) + chars[Math.floor(Math.random() * chars.length)] + text.substring(idx + 1);
        stream.innerText = text;
      });
    }, 150);
  }

  // ── Boot ───────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initStreams();
      if(typeof THREE !== 'undefined') initWebGL();
    });
  } else {
    initStreams();
    if(typeof THREE !== 'undefined') initWebGL();
  }

})();
