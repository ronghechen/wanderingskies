// Last edited by Dietrich Geisler 2025

// Global reference to the webGL context, canvas, and shaders
let g_canvas;
let gl;
let g_vshader;
let g_fshader;

// Global to keep track of the time of the _previous_ frame
let g_lastFrameMS = 0;

// Globals to track if the given list of keys are pressed
let g_keysPressed = {};
const KEYS_TO_TRACK = ['w', 'a', 's', 'd', 'r', 'f', 'ArrowUp','ArrowDown'];

let g_texture;
let g_uTint_ref;
let g_uUseTexture_ref;
let g_uAlpha_ref;
let g_uLightPos_ref; 
let g_uLightingMode_ref;   // new uniform location
let g_lightingMode = 0;
// GLSL uniform references
let g_uModel_ref;
let g_uWorld_ref;
let g_uCamera_ref;
let g_uProjection_ref;
let g_uViewPos_ref; 
let g_uTime_ref;
// Usual Matrices
let g_terrainModelMatrix;
let g_terrainWorldMatrix;
let g_projectionMatrix;
let g_worldMatrix;
// Keep track of the camera position, always looking at the center of the world
let g_cameraDistance;
let g_cameraAngle;
let g_cameraHeight;
let g_cameraPosition = null;
let g_cameraPitch = -10.0;           // degrees, negative = look slightly down
const CAMERA_PITCH_SPEED = 0.08;     // deg per ms
const CAMERA_PITCH_MIN = -85.0;      // clamp so we never flip
const CAMERA_PITCH_MAX =  85.0;
let g_sunAngle = 0;           
let g_sunPos = null;        
let g_moonPos = null; 
let g_cloudModel = null;
let g_clouds = []; 
let g_wind = {
    dir:  Math.PI * 0.25, // 45 deg across the map
    speed: 12.0           // units per second
  };
// Time-of-day modes
const TIME_DAY = 0;
const TIME_SUNSET = 1;
const TIME_NIGHT = 2;

// current time-of-day (default: day)
let g_timeOfDay = TIME_DAY;
// Terrain Mesh definition
let g_terrainMesh;
let g_terrainVBO = null; 
let g_sunModel = null;
let g_moonModel = null;
let g_starModel = null;
let g_starPositions = [];   
let g_timeElapsed = 0;
// The size in bytes of a floating point
const FLOAT_SIZE = 4;

function main() {
    // Keep track of time each frame by starting with our current time
    g_lastFrameMS = Date.now();

    g_canvas = document.getElementById('webgl-canvas');

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }
    function resizeCanvas() {
        const displayWidth  = g_canvas.clientWidth;
        const displayHeight = g_canvas.clientHeight;

        const pixelWidth  = Math.floor(displayWidth * window.devicePixelRatio);
        const pixelHeight = Math.floor(displayHeight * window.devicePixelRatio);

        if (g_canvas.width !== pixelWidth || g_canvas.height !== pixelHeight) {
            g_canvas.width = pixelWidth;
            g_canvas.height = pixelHeight;
            gl.viewport(0, 0, g_canvas.width, g_canvas.height);
        }
    }

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Setup our reactions from keys
    setupKeyBinds();

    // We will call this at the end of most main functions from now on
    loadGLSLFiles();
}

/*
 * Helper function to load our GLSL files for compiling in sequence
 */
async function loadGLSLFiles() {
    g_vshader = await fetch('./flat_color.vert').then(response => response.text()).then((x) => x);
    g_fshader = await fetch('./flat_color.frag').then(response => response.text()).then((x) => x);

    // wait until everything is loaded before rendering
    startRendering();
}

function loadTexture(url) {
    const texture = gl.createTexture();
    const image = new Image();

    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Load image data into texture
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );

        // Texture settings
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.bindTexture(gl.TEXTURE_2D, null);
    };

    image.src = url;
    return texture;
}
async function loadOBJPositions(url) {
    const response = await fetch(url);
    const text = await response.text();

    const tempPositions = [[0, 0, 0]];
    const positions = [];

    const lines = text.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#') || line === '') continue;

        const parts = line.split(/\s+/);

        if (parts[0] === 'v') {
            // vertex position
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            tempPositions.push([x, y, z]);
        } else if (parts[0] === 'f') {
            const faceVerts = parts.slice(1).map(p => {
                const idx = p.split('/')[0]; // v index
                return parseInt(idx);
            });

            for (let i = 1; i < faceVerts.length - 1; i++) {
                const idx0 = faceVerts[0];
                const idx1 = faceVerts[i];
                const idx2 = faceVerts[i + 1];

                const v0 = tempPositions[idx0];
                const v1 = tempPositions[idx1];
                const v2 = tempPositions[idx2];

                positions.push(
                    v0[0], v0[1], v0[2],
                    v1[0], v1[1], v1[2],
                    v2[0], v2[1], v2[2]
                );
            }
        }
    }

    return positions;
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, g_vshader, g_fshader)) {
        console.log('Failed to initialize shaders.');
        return;
    }
    g_texture = loadTexture("Grass-Texture.jpg");

    // Get sampler uniform
    let u_Texture = gl.getUniformLocation(gl.program, "u_Texture");

    // Use texture unit 0
    gl.uniform1i(u_Texture, 0);
    // class for building the terrain mesh
    let terrainGenerator = new TerrainGenerator();
    // use the current milliseconds as our seed by default
    // TODO: consider setting this as a constant when testing stuff!
    //   just make sure to change it back to something semi-random before submitting :)
    let seed = new Date().getMilliseconds();

    // Setup the options for our terrain generation
    // TODO: try messing around with these options!  
    //   noisefn and roughness in particular give some interesting results when changed
    let options = { 
        width: 300, 
        height: 8, 
        depth: 300, 
        seed: seed,
        noisefn: "simplex", // Other options are "simplex" and "perlin"
        roughness: 10
    };

    // construct a terrain mesh of an array of 3-vectors
    // TODO: integrate this with your code!
    let terrain = terrainGenerator.generateTerrainMesh(options);

    // give basic height-based colors based on the 3-vertex specified terrain
    // TODO: make this more interesting (see the function itself)
    //let terrainColors = buildTerrainColors(terrain, options.height);
    let terrainUVs = [];
    for (let i = 0; i < terrain.length; i++) {
        let x = terrain[i][0];
        let z = terrain[i][2];

        // Simple planar UV mapping across terrain
        let u = x / options.width;
        let v = z / options.depth;

        terrainUVs.push(u, v);
    }
    // "flatten" the terrain above to construct our usual global mesh
    g_terrainMesh = [];
    for (let i = 0; i < terrain.length; i++) {
        g_terrainMesh.push(...terrain[i]);
    }

    // Build interleaved [pos(3) + uv(2)] data
    const vertexCount = terrain.length;
    const interleaved = new Float32Array(vertexCount * 5);

    for (let i = 0; i < vertexCount; ++i) {
        const p = terrain[i];               // [x, y, z]
        const u = terrainUVs[i * 2 + 0];
        const v = terrainUVs[i * 2 + 1];

        const base = i * 5;
        interleaved[base + 0] = p[0];
        interleaved[base + 1] = p[1];
        interleaved[base + 2] = p[2];
        interleaved[base + 3] = u;
        interleaved[base + 4] = v;
    }

    // put the interleaved data into the VBO
    if (!initVBO(interleaved)) {
        return;
    }

    // Communicate our data layout to the GPU
    const STRIDE_BYTES = 5 * FLOAT_SIZE;  // 3 pos + 2 uv

    if (!setupVec(3, 'a_Position', STRIDE_BYTES, 0)) {
        return;
    }
    if (!setupVec(2, 'a_UV', STRIDE_BYTES, 3 * FLOAT_SIZE)) {
        return;
    }


    // Get references to GLSL uniforms
    g_uModel_ref = gl.getUniformLocation(gl.program, 'u_Model');
    g_uWorld_ref = gl.getUniformLocation(gl.program, 'u_World');
    g_uCamera_ref = gl.getUniformLocation(gl.program, 'u_Camera');
    g_uProjection_ref = gl.getUniformLocation(gl.program, 'u_Projection');
    g_uTint_ref = gl.getUniformLocation(gl.program, 'u_Tint');
    g_uUseTexture_ref = gl.getUniformLocation(gl.program, 'u_UseTexture');
    g_uAlpha_ref = gl.getUniformLocation(gl.program, 'u_Alpha');
    g_uLightPos_ref = gl.getUniformLocation(gl.program, 'u_LightPos');
    g_uViewPos_ref = gl.getUniformLocation(gl.program, 'u_ViewPos');
    g_uViewPos_ref = gl.getUniformLocation(gl.program, 'u_ViewPos');
    g_uIsLight_ref = gl.getUniformLocation(gl.program, 'u_IsLight');
    g_uLightingMode_ref = gl.getUniformLocation(gl.program, 'u_LightingMode');
    g_uTime_ref = gl.getUniformLocation(gl.program, 'u_Time');

    console.log('Uniform locations AFTER init:', {
        uModel: g_uModel_ref,
        uWorld: g_uWorld_ref,
        uCamera: g_uCamera_ref,
        uProjection: g_uProjection_ref,
        uTint: g_uTint_ref,
        uUseTexture: g_uUseTexture_ref,
        uAlpha: g_uAlpha_ref,
      });
    // Setup a model and world matrix for our terrain
    // Resize terrain
    g_terrainModelMatrix = new Matrix4();
    g_terrainWorldMatrix = new Matrix4().translate(-options.width / 2, -options.height, -options.depth / 2);
    g_worldMatrix = new Matrix4().setIdentity();
    // Place the camera above our terrain
    g_cameraDistance = 5.0;
    g_cameraHeight = 3.0;
    g_cameraAngle = 0.0;

    // Setup a reasonable "basic" perspective projection
    g_projectionMatrix = new Matrix4().setPerspective(90, 1, .1, 5000);

    // Enable culling and depth
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    Promise.all([
        loadOBJModel('13913_Sun_v2_l3.obj', [1.0, 0.9, 0.2]), // sun
        loadOBJModel('moon.obj', [0.9, 0.9, 1.0]), // moon
        loadOBJModel('flowers.obj', [1.0, 1.0, 1.0]), // flowers, repurposed as stars
    ]).then(([sunModel, moonModel, starModel]) => {
        g_sunModel = sunModel;
        g_moonModel = moonModel;
        g_starModel = starModel;

        //for debugging
        //console.log('Star model loaded, vertices:', g_starModel.vertexCount);
    
        initStars();
        initClouds();         
    }).catch(err => {
        console.error('Error loading OBJ models:', err);
    });
      

    // Setup for ticks
    g_lastFrameMS = Date.now();

    tick();
}

function initStars() {
    g_starPositions = [];
  
    const STAR_COUNT = 120;
    const MIN_RADIUS = 120.0;
    const MAX_RADIUS = 350.0;
    const MIN_HEIGHT = 140.0;
    const MAX_HEIGHT = 260.0;
  
    for (let i = 0; i < STAR_COUNT; ++i) {
      const angle = Math.random() * Math.PI * 2.0;
      const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);
  
      g_starPositions.push({
        x, y, z,
        // twinkle personality
        phase: Math.random() * Math.PI * 2.0, // offsets the sine
        speed: 0.6 + Math.random() * 1.2,     // multiplier
        base: 0.55 + Math.random() * 0.25,    // baseline brightness
        amp: 0.20 + Math.random() * 0.25      // how much it fluctuates
      });
    }
  }
  

// Animation constants
const CAMERA_SPEED = .01;
const CAMERA_ROTATION_SPEED = .1;
const CAMERA_ZOOM_SPEED = .05;

const CAMERA_MIN_DISTANCE = 5.0;
const CAMERA_MAX_DISTANCE = 80.0;

// function to apply all the logic for a single frame tick
function tick() {
    // Calculate time since the last frame
    let currentTime = Date.now();
    let deltaMS = currentTime - g_lastFrameMS;
    g_lastFrameMS = currentTime;
    g_timeElapsed += deltaMS;
    updateCameraPosition(deltaMS);
    updateSunAndMoon(deltaMS);
    draw()
    requestAnimationFrame(tick, g_canvas)
}

function initClouds() {
    g_clouds = [];
    const CLOUD_COUNT = 8;
    const BASE_HEIGHT = 800.0;
    const HEIGHT_RANGE = 300.0;
    const MIN_RADIUS = 180.0;
    const MAX_RADIUS = 320.0;
  
    for (let i = 0; i < CLOUD_COUNT; ++i) {
      const angle = Math.random() * Math.PI * 2.0;
      const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
      const height = BASE_HEIGHT + (Math.random() - 0.5) * HEIGHT_RANGE;
      const scale = 0.5 + Math.random() * 0.4;
  
      // base ring position (so we can add wind on top)
      const baseX = Math.cos(angle) * radius;
      const baseZ = Math.sin(angle) * radius;
  
      g_clouds.push({
        // static shape
        baseX, baseZ, height, radius, scale,
  
        // wind + wobble “personality”
        wobbleAmp: 6.0 + Math.random() * 10.0,
        wobbleFreq: 0.05 + Math.random() * 0.10,
        phaseX: Math.random() * Math.PI * 2.0,
        phaseZ: Math.random() * Math.PI * 2.0,
  
        // subtle “breathing” of the puff
        pulseAmp: 0.08,                                
        pulseFreq: 0.15 + Math.random() * 0.25,
        pulsePhase: Math.random() * Math.PI * 2.0,
  
        // alpha flicker (very gentle)
        alphaBase: 0.50 + Math.random() * 0.10,
        alphaAmp: 0.12 + Math.random() * 0.08,
      });
    }
  }
  


// Draw clouds, tinted by the current time-of-day color
function drawClouds(envR, envG, envB) {
    // No clouds at night
    if (g_timeOfDay === TIME_NIGHT) {
        return;
    }
    if (!g_sunModel || g_clouds.length === 0) {
        return;
    }
  
    // gently sky-tinted white
    const baseCloudR = 0.3 * envR + 0.7;
    const baseCloudG = 0.3 * envG + 0.7;
    const baseCloudB = 0.3 * envB + 0.7;
    const t = performance.now() * 0.001; // seconds
  
    // soft alpha edges
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); 
    // clouds are high—z-fighting is unlikely; keep depth test on so they sort against sun/moon
    // gl.enable(gl.DEPTH_TEST);
  
    // precompute wind offset
    const windDX = Math.cos(g_wind.dir) * g_wind.speed * t;
    const windDZ = Math.sin(g_wind.dir) * g_wind.speed * t;
  
    for (const c of g_clouds) {
      // wobble around the wind path
      const wobX = c.wobbleAmp * Math.sin(t * c.wobbleFreq + c.phaseX);
      const wobZ = 0.6 * c.wobbleAmp * Math.cos(t * c.wobbleFreq * 0.8 + c.phaseZ);
  
      // base + wind drift + wobble
      const x = c.baseX + windDX + wobX;
      const z = c.baseZ + windDZ + wobZ;
      const y = c.height;
  
      // subtle “breathing” of the puff
      const breath = 1.0 + c.pulseAmp * Math.sin(t * c.pulseFreq + c.pulsePhase);
  
      // very gentle opacity flicker
      const alpha = Math.min(
        0.95,
        Math.max(0.15, c.alphaBase + c.alphaAmp * Math.sin(t * (c.pulseFreq * 1.3) + c.pulsePhase * 1.7))
      );
  
      // model xform
      const m = new Matrix4();
      m.setIdentity();
      m.translate(x, y, z);
      m.scale(c.scale * breath, c.scale * 0.8 * breath, c.scale * breath);
  
      // draw (blob model used for both clouds and sun)
      g_sunModel.modelMatrix = m;
      drawModel(
        g_sunModel,
        baseCloudR, baseCloudG, baseCloudB,
        alpha,
        null,
        /* isLight = */ false
      );
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

// draw to the screen on the next frame
function draw() {
    const canvas = document.getElementById("webgl-canvas");
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (g_uTime_ref) {
        const t = performance.now() * 0.001; // ms to seconds
        gl.uniform1f(g_uTime_ref, t);
    }
    let skyR, skyG, skyB;
    if (g_timeOfDay === TIME_DAY) {
        skyR = 0.53; skyG = 0.81; skyB = 0.98;    // day sky blue
    } else if (g_timeOfDay === TIME_SUNSET) {
        skyR = 0.99; skyG = 0.55; skyB = 0.25;    // orange sunset
    } else { // TIME_NIGHT
        skyR = 0.02; skyG = 0.02; skyB = 0.08;    // dark night blue
    }

    gl.clearColor(skyR, skyG, skyB, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(g_uLightingMode_ref, g_lightingMode);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g_texture);
    const cameraMatrix = calculateCameraMatrix();
    gl.uniformMatrix4fv(g_uCamera_ref,     false, cameraMatrix.elements);
    gl.uniformMatrix4fv(g_uProjection_ref, false, g_projectionMatrix.elements);
    if (g_cameraPosition && g_uViewPos_ref) {
        gl.uniform3f(
            g_uViewPos_ref,
            g_cameraPosition.elements[0],
            g_cameraPosition.elements[1],
            g_cameraPosition.elements[2]
        );
    }

    // Time of day tints
    let terrainR, terrainG, terrainB;
    let sunR, sunG, sunB;
    let moonR, moonG, moonB;

    if (g_timeOfDay === TIME_DAY) {
        // bright grass, warm sun, cool moon (even if we don't show it)
        terrainR = 1.0; terrainG = 1.0; terrainB = 1.0;
        sunR = 1.0;  sunG = 0.95; sunB = 0.50;
        moonR = 0.90; moonG = 0.90; moonB = 1.00;
    } else if (g_timeOfDay === TIME_SUNSET) {
        // warm tint on grass at sunset
        terrainR = 1.0; terrainG = 0.95; terrainB = 0.85;
        sunR = 1.0;  sunG = 0.80; sunB = 0.30;
        moonR = 0.90; moonG = 0.90; moonB = 1.00;
    } else { // NIGHT
        // darker, bluish grass at night
        terrainR = 0.40; terrainG = 0.45; terrainB = 0.60;
        sunR = 1.0;  sunG = 0.80; sunB = 0.30;
        moonR = 0.90; moonG = 0.90; moonB = 1.00;
    }
    let activeLight = null;

    if (g_timeOfDay === TIME_NIGHT) {
        // At night we want the moon to be the main light source
        activeLight = g_moonPos || g_sunPos;
    } else {
        // During day and sunset we light from the sun
        activeLight = g_sunPos || g_moonPos;
    }

    if (activeLight && g_uLightPos_ref) {
        gl.uniform3f(
            g_uLightPos_ref,
            activeLight.elements[0],
            activeLight.elements[1],
            activeLight.elements[2]
        );
    }
    if (g_uLightingMode_ref) {
        gl.uniform1f(g_uLightingMode_ref, g_lightingMode);
    }

    if (g_terrainVBO) {
        gl.bindBuffer(gl.ARRAY_BUFFER, g_terrainVBO);

        const STRIDE_BYTES = 5 * FLOAT_SIZE;  // pos(3) + uv(2)

        if (!setupVec(3, 'a_Position', STRIDE_BYTES, 0))              return;
        if (!setupVec(2, 'a_UV',       STRIDE_BYTES, 3 * FLOAT_SIZE)) return;

        gl.uniformMatrix4fv(g_uModel_ref, false, g_terrainModelMatrix.elements);
        gl.uniformMatrix4fv(g_uWorld_ref, false, g_terrainWorldMatrix.elements);
        gl.uniform3f(g_uTint_ref, terrainR, terrainG, terrainB);
        gl.uniform1f(g_uUseTexture_ref, 1.0);  
        gl.uniform1f(g_uAlpha_ref, 1.0);
        gl.uniform1f(g_uIsLight_ref, 0.0);

        gl.drawArrays(gl.TRIANGLES, 0, g_terrainMesh.length / 3);
    }
    // Clouds use the sky color as their environment tint


    if (g_sunModel && g_timeOfDay !== TIME_NIGHT) { // Sun shows up
        drawModel(g_sunModel, sunR, sunG, sunB, 1.0, null, false);
    }

    // Moon shows up at night only
    if (g_moonModel && g_timeOfDay === TIME_NIGHT) {
        drawModel(g_moonModel, moonR, moonG, moonB, 1.0, null, false);
    }
    drawClouds(skyR, skyG, skyB);

    // Stars (night only)
    drawStars();
}


function drawModel(model, r, g, b, a, modelMatrixOverride, isLight) {
    if (isLight === undefined) {
        isLight = false;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, model.vbo);
    const STRIDE_BYTES = 5 * FLOAT_SIZE;
    setupVec(3, 'a_Position', STRIDE_BYTES, 0);
    setupVec(2, 'a_UV',       STRIDE_BYTES, 3 * FLOAT_SIZE);

    const m = modelMatrixOverride || model.modelMatrix;
    gl.uniformMatrix4fv(g_uModel_ref, false, m.elements);
    gl.uniformMatrix4fv(g_uWorld_ref, false, g_worldMatrix.elements);

    gl.uniform3f(g_uTint_ref, r, g, b);
    gl.uniform1f(g_uUseTexture_ref, 0.0);     // tint-only for these models
    gl.uniform1f(g_uAlpha_ref, a);
    gl.uniform1f(g_uIsLight_ref, isLight ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, model.vertexCount);
}



function drawStars() {
    if (!g_starModel || g_timeOfDay !== TIME_NIGHT) return;
  
    // gentle vertical bobbing
    const floatAmt = Math.sin(g_timeElapsed * 0.002) * 5.0;
  
    // draw on top so tiny stars don't z-fight
    gl.disable(gl.DEPTH_TEST);
  
    const t = g_timeElapsed * 0.001; // seconds
  
    for (const s of g_starPositions) {
      // base + amp*sin(speed*t + phase)
      let tw = s.base + s.amp * Math.sin(s.speed * t + s.phase);
  
      // tiny chance of short sparkle bursts (rare, bright spikes)
      const sparkle =
        (Math.sin((s.phase * 43758.5453) + t * 8.0) * 0.5 + 0.5) > 0.985 ? 0.35 : 0.0;
  
      const alpha = Math.min(1.0, Math.max(0.08, tw + sparkle));
      const size  = 0.18 + 0.07 * tw; // subtle shimmer
  
      const m = new Matrix4();
      m.setIdentity();
      m.translate(s.x, s.y + floatAmt, s.z);
      m.scale(size, size, size);
      g_starModel.modelMatrix = m;
  
      // slightly bluish-white looks nice at night
      drawModel(g_starModel, 0.95, 0.97, 1.0, alpha);
    }
  
    gl.enable(gl.DEPTH_TEST);
  }
  

/*
 * Helper function to update the camera position each frame
 */
function updateCameraPosition(deltaMS) {
    // Move the camera based on user input
    if (g_keysPressed['r']) {
        g_cameraHeight += CAMERA_SPEED * deltaMS;
    }
    if (g_keysPressed['f']) {
        g_cameraHeight -= CAMERA_SPEED * deltaMS;
    }
    if (g_keysPressed['a']) {
        g_cameraAngle -= CAMERA_ROTATION_SPEED * deltaMS;
    }
    if (g_keysPressed['d']) {
        g_cameraAngle += CAMERA_ROTATION_SPEED * deltaMS;
    }
    if (g_keysPressed['w']) {
        g_cameraDistance += CAMERA_ZOOM_SPEED * deltaMS;
    }
    if (g_keysPressed['s']) {
        g_cameraDistance -= CAMERA_ZOOM_SPEED * deltaMS;
    }
    if (g_keysPressed['ArrowUp']) {
        g_cameraPitch += CAMERA_PITCH_SPEED * deltaMS;
      }
      if (g_keysPressed['ArrowDown']) {
        g_cameraPitch -= CAMERA_PITCH_SPEED * deltaMS;
      }
      g_cameraPitch = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, g_cameraPitch));

    // Clamp zoom so we never get too far away
    if (g_cameraDistance < CAMERA_MIN_DISTANCE) {
        g_cameraDistance = CAMERA_MIN_DISTANCE;
    }
    if (g_cameraDistance > CAMERA_MAX_DISTANCE) {
        g_cameraDistance = CAMERA_MAX_DISTANCE;
    }
}

function updateSunAndMoon(deltaMS) {
    if (!g_sunModel || !g_moonModel) return;

    const ORBIT_SPEED = 0.0002;
    const SUN_RADIUS  = 120.0;
    const MOON_RADIUS = 140.0;

    const SUN_BASE_HEIGHT   = 2000.0;  //Wish it could be higher up but I still want the sun/moon to be visible
    const SUN_HEIGHT_AMPL   = 60.0;

    const MOON_BASE_HEIGHT  = 1000.0;
    const MOON_HEIGHT_AMPL  = 60.0;

    g_sunAngle += ORBIT_SPEED * deltaMS;

    let sx = Math.cos(g_sunAngle) * SUN_RADIUS;
    let sz = Math.sin(g_sunAngle) * SUN_RADIUS;
    let sy = SUN_BASE_HEIGHT + Math.sin(g_sunAngle) * SUN_HEIGHT_AMPL;
    if (g_timeOfDay === TIME_SUNSET) {
        const SUNSET_DROP = 2000.0;      // how much to lower it
        const MIN_SUNSET_HEIGHT = 150.0; // don't let it go below terrain
        sy = Math.max(MIN_SUNSET_HEIGHT, sy - SUNSET_DROP);
    }
    g_sunPos = new Vector3([sx, sy, sz]);

    g_sunModel.modelMatrix.setIdentity();
    g_sunModel.modelMatrix.translate(sx, sy, sz);
    g_sunModel.modelMatrix.scale(0.03, 0.03, 0.03);

    let moonAngle = g_sunAngle + Math.PI;
    let mx = Math.cos(moonAngle) * (MOON_RADIUS * 1.1);
    let mz = Math.sin(moonAngle) * (MOON_RADIUS * 1.1);
    let my = MOON_BASE_HEIGHT + Math.sin(moonAngle) * MOON_HEIGHT_AMPL * 0.7;

    g_moonPos = new Vector3([mx, my, mz]);

    g_moonModel.modelMatrix.setIdentity();
    g_moonModel.modelMatrix.translate(mx, my, mz);
    g_moonModel.modelMatrix.scale(0.04, 0.04, 0.04);
}



/*
 * Helper to construct _basic_ per-vertex terrain colors
 * We use the height of the terrain to select a color between white and blue
 * Requires that we pass in the height of the terrain (as a number), but feel free to change this
 * TODO: you should expect to modify this helper with custom (or more interesting) colors
 */
function buildTerrainColors(terrain, height) {
    let colors = []
    for (let i = 0; i < terrain.length; i++) {
        // calculates the vertex color for each vertex independent of the triangle
        // the rasterizer can help make this look "smooth"

        // we use the y axis of each vertex alone for color
        // higher "peaks" have more shade
        let shade = (terrain[i][1] / height) + 1/2
        let color = [shade, shade, 1.0]

        // give each triangle 3 colors
        colors.push(...color)
    }

    return colors
}

/**
 * Helper function to split out the camera math
 * You may want to modify this to have a free-moving camera
 */
function calculateCameraMatrix() {
    // Current orbit position (unchanged)
    let camX = Math.sin(Math.PI * g_cameraAngle / 180) * g_cameraDistance;
    let camZ = Math.cos(Math.PI * g_cameraAngle / 180) * g_cameraDistance;
    let camY = g_cameraHeight;
  
    let cameraPosition = new Vector3([camX, camY, camZ]);
    g_cameraPosition = cameraPosition;
  
    // Forward vector for turning cam up/down
    const yawRad   = (Math.PI * g_cameraAngle) / 180.0;
    const pitchRad = (Math.PI * g_cameraPitch) / 180.0;
  
    // Forward in world space
    const fx = Math.sin(yawRad) * Math.cos(pitchRad);
    const fy = Math.sin(pitchRad);
    const fz = Math.cos(yawRad) * Math.cos(pitchRad);
  
    const target = new Vector3([
      cameraPosition.elements[0] + fx,
      cameraPosition.elements[1] + fy,
      cameraPosition.elements[2] + fz
    ]);
  
    return new Matrix4().setLookAt(
      cameraPosition,
      target,
      new Vector3([0, 1, 0])
    );
  }
  

/**
 * Helper function to setup key binding logic
 */
function setupKeyBinds() {
    // Setup the dictionary of keys we're tracking
    KEYS_TO_TRACK.forEach(key => {
        g_keysPressed[key] = false;
    });

    // Set key flag to true when key starts being pressed
    document.addEventListener('keydown', function (event) {
        KEYS_TO_TRACK.forEach(key => {
            if (event.key == key) {
                g_keysPressed[key] = true;
            }
        });
        if (event.key === '1') {
            g_timeOfDay = TIME_DAY;
            console.log('Switched to DAY');
        } else if (event.key === '2') {
            g_timeOfDay = TIME_SUNSET;
            console.log('Switched to SUNSET');
        } else if (event.key === '3') {
            g_timeOfDay = TIME_NIGHT;
            console.log('Switched to NIGHT');
        }
        if (event.key === 't' || event.key === 'T') {
            // Toggle lighting mode: 0 <-> 1
            g_lightingMode = 1 - g_lightingMode;
            console.log('Lighting mode:', g_lightingMode === 0 ? 'Blinn-Phong' : 'Toon');
        }
    })

    // Set key flag to false when key starts being pressed
    document.addEventListener('keyup', function (event) {
        KEYS_TO_TRACK.forEach(key => {
            if (event.key == key) {
                g_keysPressed[key] = false;
            }
        });
    })
}

/**
 * Initialize the VBO with the provided data
 * Assumes we are going to have "static" (unchanging) data
 * @param {Float32Array} data 
 * @return {Boolean} true if the VBO was setup successfully, and false otherwise
 */
function initVBO(data) {
    // get the VBO handle
    let VBOloc = gl.createBuffer();
    if (!VBOloc) {
        console.error('Failed to create the vertex buffer object');
        return false;
    }

    // Bind the VBO to the GPU array and copy `data` into that VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    // Remember this VBO as the terrain VBO
    g_terrainVBO = VBOloc;

    return true;
}

/**
 * Specifies properties of the given attribute on the GPU
 * @param {Number} length : the length of the vector (e.g. 3 for a Vector3);
 * @param {String} name : the name of the attribute in GLSL
 * @param {Number} stride : the stride in bytes
 * @param {Number} offset : the offset in bytes
 * @return {Boolean} true if the attribute was setup successfully, and false otherwise
 */
function setupVec(length, name, stride, offset) {
    // Get the attribute by name
    let attributeID = gl.getAttribLocation(gl.program, `${name}`);
    if (attributeID < 0) {
        console.error(`Failed to get the storage location of ${name}`);
        return false;
    }

    // Set how the GPU fills the a_Position letiable with data from the GPU 
    gl.vertexAttribPointer(attributeID, length, gl.FLOAT, false, stride, offset);
    gl.enableVertexAttribArray(attributeID);

    return true;
}

function parseOBJ(text) {
    const lines = text.split('\n');

    const positions = [[0, 0, 0]];   // index 0 = dummy so OBJ indices (1-based) line up
    const texcoords = [[0, 0]];
    const normals = [[0, 0, 1]];

    const finalPositions = [];
    const finalTexcoords = [];
    const finalNormals = [];

    function parseIndex(value, arrayLength) {
        if (!value) return 0;
        let index = parseInt(value);
        if (index < 0) {
            index = arrayLength + index;
        }
        return index;
    }

    for (let line of lines) {
        line = line.trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        const parts = line.split(/\s+/);
        const keyword = parts[0];

        if (keyword === 'v') {
            // vertex position
            positions.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3]),
            ]);
        } else if (keyword === 'vt') {
            // texture coordinate
            texcoords.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
            ]);
        } else if (keyword === 'vn') {
            // normal
            normals.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3]),
            ]);
        } else if (keyword === 'f') {
            // face: triangulate using a fan if needed
            const faceVerts = parts.slice(1);

            // turn polygon into triangles (v0, vi-1, vi)
            for (let i = 1; i < faceVerts.length - 1; ++i) {
                const idx = [0, i, i + 1];

                for (let k = 0; k < 3; ++k) {
                    const verts = faceVerts[idx[k]].split('/');
                    const vi = parseIndex(verts[0], positions.length);
                    const ti = parseIndex(verts[1], texcoords.length);
                    const ni = parseIndex(verts[2], normals.length);

                    const pos = positions[vi];
                    finalPositions.push(pos[0], pos[1], pos[2]);

                    const tex = texcoords[ti] || [0, 0];
                    finalTexcoords.push(tex[0], tex[1]);

                    const nor = normals[ni] || [0, 0, 1];
                    finalNormals.push(nor[0], nor[1], nor[2]);
                }
            }
        }
    }

    return {
        position: new Float32Array(finalPositions),
        texcoord: new Float32Array(finalTexcoords),
        normal: new Float32Array(finalNormals),
    };
}

// Create a VBO for a model where layout = [positions][colors]
function createModelFromOBJ(objData, colorRGB) {
    const positions   = objData.position;
    const texcoords   = objData.texcoord;  // may be empty
    const vertexCount = positions.length / 3;

    // Build per-vertex UVs:
    let uvs;
    if (texcoords && texcoords.length >= vertexCount * 2) {
        uvs = texcoords;
    } else {
        uvs = new Float32Array(vertexCount * 2);
        for (let i = 0; i < vertexCount; ++i) {
            uvs[i * 2 + 0] = 0.0;
            uvs[i * 2 + 1] = 0.0;
        }
    }

    // Interleave [pos(3) + uv(2)]
    const data = new Float32Array(vertexCount * 5);
    for (let i = 0; i < vertexCount; ++i) {
        const pi = i * 3;
        const ti = i * 2;
        const di = i * 5;

        data[di + 0] = positions[pi + 0];
        data[di + 1] = positions[pi + 1];
        data[di + 2] = positions[pi + 2];
        data[di + 3] = uvs[ti + 0];
        data[di + 4] = uvs[ti + 1];
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    return {
        vbo: vbo,
        vertexCount: vertexCount,
        modelMatrix: new Matrix4(),
    };
}

// Load an OBJ file over HTTP and build a model
async function loadOBJModel(url, colorRGB) {
    const response = await fetch(url);
    const text = await response.text();
    const objData = parseOBJ(text);
    return createModelFromOBJ(objData, colorRGB);
}