// cuon-utils.js (c) 2012 kanda and matsuda
// last updated by dietrich geisler 2025 with obj loading functions
/**
 * Create a program object and make current
 * @param gl GL context
 * @param {String} vshader a vertex shader program
 * @param {String} fshader a fragment shader program
 * @return {Boolean} true, if the program object was created and successfully made current 
 */
function initShaders(gl, vshader, fshader) {
    let program = createProgram(gl, vshader, fshader);
    if (!program) {
        console.log('Failed to create program');
        return false;
    }

    gl.useProgram(program);
    gl.program = program;

    return true;
}

/**
 * Create the linked program object
 * @param gl GL context
 * @param {String} vshader a vertex shader program
 * @param {String} fshader a fragment shader program
 * @return created program object, or null if the creation has failed
 */
function createProgram(gl, vshader, fshader) {
    // Create shader object
    let vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader);
    let fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
    if (!vertexShader || !fragmentShader) {
        return null;
    }

    // Create a program object
    let program = gl.createProgram();
    if (!program) {
        return null;
    }

    // Attach the shader objects
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    // Link the program object
    gl.linkProgram(program);

    // Check the result of linking
    let linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        let error = gl.getProgramInfoLog(program);
        console.log('Failed to link program: ' + error);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
        gl.deleteShader(vertexShader);
        return null;
    }
    return program;
}

/**
 * Create a shader object
 * @param gl GL context
 * @param type the type of the shader object to be created
 * @param {String} source shader program
 * @return created shader object, or null if the creation has failed.
 */
function loadShader(gl, type, source) {
    // Create shader object
    let shader = gl.createShader(type);
    if (shader == null) {
        console.log('unable to create shader');
        return null;
    }

    // Set the shader program
    gl.shaderSource(shader, source);

    // Compile the shader
    gl.compileShader(shader);

    // Check the result of compilation
    let compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
        let error = gl.getShaderInfoLog(shader);
        console.log('Failed to compile shader: ' + error);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

/** 
 * Initialize and get the rendering for WebGL
 * @param canvas <canvas> element
 * @param {Boolean} opt_debug flag to initialize the context for debugging
 * @return the rendering context for WebGL
 */
function getWebGLContext(canvas, opt_debug) {
    // Get the rendering context for WebGL
    let gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) return null;

    // if opt_debug is explicitly false, create the context for debugging
    if (arguments.length < 2 || opt_debug) {
        gl = WebGLDebugUtils.makeDebugContext(gl);
    }

    return gl;
}

/**
 * Given the contents of a .obj file and a collection of lists to read results into
 * Populates those lists with positions, normals, and texture coordinates
 *     
 * If the .obj file doesn't contain information for any of these data
 *     then those lists will not be populated
 * @param {String} objstring, the string contents in obj format
 * @param {Number[]} positions, a list to be populated with position information
 * @param {Number[]} normals, a list to be populated with normal information
 * @param {Number[]} texcoords, a list to be populated with texture coordinate information
 * @returns {Number} 1 if the obj string was succesfully read, and 0 otherwise
 */
function readObjFile(objstring, positions, normals = [], texcoords = []) {
    let lines = objstring.split('\n');
    let v = [];
    let vt = [];
    let vn = [];
    let f = [];
    // first read all of the data
    for (const line of lines) {
        // split on whitespace
        sline = line.split(/[ ,]+/);
        if (sline[0] == 'v') {
            v.push(sline.slice(1, 4).map((x) => Number(x)));
        }
        else if (sline[0] == 'vt') {
            vt.push(sline.slice(1, 3).map((x) => Number(x)));
        }
        else if (sline[0] == 'vn') {
            vn.push(sline.slice(1, 4).map((x) => Number(x)));
        }
        else if (sline[0] == 'f') {
            f = f.concat(sline.slice(1, 4));
        }
    }
    // then process each face
    for (const face of f) {
        // see if we are looking for each kind of data
        let vIndex = -1;
        let vtIndex = -1;
        let vnIndex = -1;
        if (face.indexOf('/') > -1) {
            let faceData = face.split('/');
            if (faceData[0] != '') {
                vIndex = Number(faceData[0]) - 1;
            }
            if (faceData[1] != '') {
                vtIndex = Number(faceData[1]) - 1;
            }
            if (faceData[2] != '') {
                vnIndex = Number(faceData[2]) - 1;
            }
        }
        else {
            let index = Number(face) - 1;
            vIndex = index;
            if (vt.length > 0) {
                vtIndex = index;
            }
            if (vn.length > 0) {
                vnIndex = index;
            }
        }
        // add the data to the array, erroring if out of bounds
        if (vIndex > -1) {
            if (vIndex > v.length) {
                console.error(`Face vertex index ${vIndex} missing associated vertex`);
                return 0;
            }
            positions.push(v[vIndex][0]);
            positions.push(v[vIndex][1]);
            positions.push(v[vIndex][2]);
        }
        // repeat for texcoords
        if (vtIndex > -1) {
            if (vtIndex > vt.length) {
                console.error(`Face texture index ${vtIndex} missing associated vertex`);
                return 0;
            }
            texcoords.push(vt[vtIndex][0]);
            texcoords.push(vt[vtIndex][1]);
        }
        // repeat for normals
        if (vnIndex > -1) {
            if (vnIndex > vn.length) {
                console.error(`Face normal index ${vnIndex} missing associated vertex`);
                return 0;
            }
            normals.push(vn[vnIndex][0]);
            normals.push(vn[vnIndex][1]);
            normals.push(vn[vnIndex][2]);
        }
    }
    return 1;
}

/**
 * Given the contents of a .obj file and a collection of dictionaries to read results into
 * Populates those dictionaries with positions, normals, and texture coordinates
 *     
 * If the .obj file doesn't contain information for any of these data
 *     then those dictionaries will not be populated
 * @param {String} objstring, the string contents in obj format
 * @param {Object} positions, a dictionary to be populated with position information
 * @param {Object} normals, a dictionary to be populated with normal information
 * @param {Object} texcoords, a dictionary to be populated with texture coordinate information
 * @returns {Number} 1 if the obj string was succesfully read, and 0 otherwise
 */
function readObjFileByGroup(objstring, positions, normals = {}, texcoords = {}) {
    let lines = objstring.split('\n');
    let v = [];
    let vt = [];
    let vn = [];
    let f = {};
    let group = "";
    // first read all of the data
    for (const line of lines) {
        // split on whitespace
        sline = line.split(/[ ,]+/)
        if (sline[0] == 'v') {
            v.push(sline.slice(1, 4).map((x) => Number(x)));
        }
        else if (sline[0] == 'vt') {
            vt.push(sline.slice(1, 3).map((x) => Number(x)));
        }
        else if (sline[0] == 'vn') {
            vn.push(sline.slice(1, 4).map((x) => Number(x)));
        }
        else if (sline[0] == 'g') {
            group = sline.slice(1, 2)[0].trim();
        }
        else if (sline[0] == 'f') {
            if (typeof f[group] === 'undefined') {
                f[group] = [];
                positions[group] = [];
                normals[group] = [];
                texcoords[group] = [];
            }
            f[group] = f[group].concat(sline.slice(1, 4));
        }
    }
    // then process each face
    for (const group in f) {
        for (var i = 0; i < f[group].length; i++) {
            const face = f[group][i];
            // see if we are looking for each kind of data
            let vIndex = -1;
            let vtIndex = -1;
            let vnIndex = -1;
            if (face.indexOf('/') > -1) {
                let faceData = face.split('/');
                if (faceData[0] != '') {
                    vIndex = Number(faceData[0]) - 1;
                }
                if (faceData[1] != '') {
                    vtIndex = Number(faceData[1]) - 1;
                }
                if (faceData[2] != '') {
                    vnIndex = Number(faceData[2]) - 1;
                }
            }
            else {
                let index = Number(face) - 1;
                vIndex = index;
                if (vt.length > 0) {
                    vtIndex = index;
                }
                if (vn.length > 0) {
                    vnIndex = index;
                }
            }
            // add the data to the array, erroring if out of bounds
            if (vIndex > -1) {
                if (vIndex > v.length) {
                    console.error(`Face vertex index ${vIndex} missing associated vertex`);
                    return 0;
                }
                positions[group].push(v[vIndex][0]);
                positions[group].push(v[vIndex][1]);
                positions[group].push(v[vIndex][2]);
            }
            // repeat for texcoords
            if (vtIndex > -1) {
                if (vtIndex > vt.length) {
                    console.error(`Face texture index ${vtIndex} missing associated vertex`);
                    return 0;
                }
                texcoords[group].push(vt[vtIndex][0]);
                texcoords[group].push(vt[vtIndex][1]);
            }
            // repeat for normals
            if (vnIndex > -1) {
                if (vnIndex > vn.length) {
                    console.error(`Face normal index ${vnIndex} missing associated vertex`);
                    return 0;
                }
                normals[group].push(vn[vnIndex][0]);
                normals[group].push(vn[vnIndex][1]);
                normals[group].push(vn[vnIndex][2]);
            }
        }
    }
    return 1;
}