/**
 * WebGL Image Compiler
 * A pure vanilla WebGL implementation to replace static images with a 
 * highly sophisticated "memory decryption / compilation" shader effect.
 */

class GLCompiler {
    constructor(imageElement) {
        this.img = imageElement;
        this.canvas = document.createElement('canvas');
        this.gl = this.canvas.getContext('webgl');
        
        if (!this.gl) {
            console.warn("WebGL not supported. Falling back to static image.");
            return;
        }

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'gl-canvas-wrapper';
        
        // Replace image in DOM
        this.img.parentNode.insertBefore(this.wrapper, this.img);
        this.wrapper.appendChild(this.img);
        this.wrapper.appendChild(this.canvas);
        
        this.img.style.opacity = '0'; // hide original but keep it for dimensions/SEO
        
        this.progress = 0.0;
        this.targetProgress = 0.0;
        this.isCompiled = false;

        this.initWebGL();
        this.resize();
        
        window.addEventListener('resize', () => this.resize());
    }

    initWebGL() {
        const gl = this.gl;

        // --- Shaders ---
        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        // The Decryption Shader
        const fsSource = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_time;
            uniform float u_progress;
            uniform vec2 u_resolution;

            // Pseudo-random noise
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            void main() {
                vec2 uv = v_texCoord;
                
                // When progress is 1.0, just show the image
                if (u_progress >= 1.0) {
                    gl_FragColor = texture2D(u_image, uv);
                    return;
                }

                // Grid pixelation size based on progress (compiling effect)
                float blocks = mix(20.0, 200.0, u_progress);
                vec2 gridUV = floor(uv * blocks) / blocks;
                
                // Add noise/glitch offset based on grid and time
                float noise = random(gridUV + floor(u_time * 10.0));
                vec2 offset = vec2(noise * 0.1, random(gridUV * 2.0) * 0.1) * (1.0 - u_progress);
                
                vec2 sampleUV = uv;
                
                // Only pixelate and offset if not fully compiled
                if (random(gridUV) > u_progress) {
                    sampleUV = gridUV + offset;
                }

                // Sample the image
                vec4 color = texture2D(u_image, sampleUV);
                
                // Convert to dark matrix/cyan colors when compiling
                float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                vec3 compiledColor = color.rgb;
                vec3 rawColor = mix(vec3(0.0, 0.2, 0.3), vec3(0.0, 0.9, 1.0), luma * noise); // tech cyan
                
                // Add scanlines
                float scanline = sin(uv.y * 800.0 + u_time * 10.0) * 0.04;
                
                vec3 finalColor = mix(rawColor, compiledColor, smoothstep(0.4, 1.0, u_progress));
                finalColor -= scanline * (1.0 - u_progress);

                // Fade in from black
                gl_FragColor = vec4(finalColor * u_progress, 1.0);
            }
        `;

        this.program = this.createProgram(vsSource, fsSource);
        gl.useProgram(this.program);

        // --- Geometry ---
        const positions = new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0,
        ]);
        
        const texCoords = new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            0.0, 0.0,
            1.0, 1.0,
            1.0, 0.0,
        ]);

        // Position buffer
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        const positionLocation = gl.getAttribLocation(this.program, "a_position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // TexCoord buffer
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        const texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // --- Texture ---
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        // Set parameters so we can render non-power-of-2 images
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload image to texture
        if (this.img.complete && this.img.naturalHeight !== 0) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
        } else {
            this.img.addEventListener('load', () => {
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
            });
        }

        // --- Uniforms ---
        this.timeLoc = gl.getUniformLocation(this.program, "u_time");
        this.progressLoc = gl.getUniformLocation(this.program, "u_progress");
        this.resLoc = gl.getUniformLocation(this.program, "u_resolution");

        this.startTime = performance.now();
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    resize() {
        const rect = this.wrapper.getBoundingClientRect();
        // Use device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.gl.useProgram(this.program);
            this.gl.uniform2f(this.resLoc, this.canvas.width, this.canvas.height);
        }
    }

    compile() {
        this.targetProgress = 1.0;
        if (!this.isCompiled) {
            this.isCompiled = true;
            this.render(); // Start loop if not running
        }
    }

    render() {
        if (!this.gl) return;
        
        // Lerp progress for smooth compilation
        this.progress += (this.targetProgress - this.progress) * 0.04;
        
        const gl = this.gl;
        const time = (performance.now() - this.startTime) * 0.001;

        gl.uniform1f(this.timeLoc, time);
        gl.uniform1f(this.progressLoc, this.progress);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Keep rendering if compiling, or if not fully reached 1.0
        if (this.progress < 0.999 || this.targetProgress !== 1.0) {
            requestAnimationFrame(() => this.render());
        } else {
            // Ensure exact 1.0 at the end
            gl.uniform1f(this.progressLoc, 1.0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }
}

// Initialization on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
    const glImages = document.querySelectorAll('.gl-reveal');
    
    // Instantiate compiler for each image
    const compilers = Array.from(glImages).map(img => new GLCompiler(img));
    
    // Intersection Observer to trigger compilation
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Find the compiler instance that matches this image
                    const compiler = compilers.find(c => c.img === entry.target);
                    if (compiler) {
                        // Add slight delay to make it feel heavy and intentional
                        setTimeout(() => compiler.compile(), 200);
                        observer.unobserve(entry.target);
                    }
                }
            });
        }, { threshold: 0.3 });
        
        glImages.forEach(img => observer.observe(img));
    } else {
        compilers.forEach(c => c.compile());
    }
});
