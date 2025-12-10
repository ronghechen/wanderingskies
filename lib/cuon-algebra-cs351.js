// cuon-matrix.js (c) 2012 kanda and matsuda
/** 
 * This is a class treating 4x4 matrix from the book 
 *	"WebGL Programming Guide" (2013),
 * Note that functions have been adjusted to 
 *   multiply from the left rather than the right
 * MODIFIED 2/2014,8 by Jack Tumblin and students in Northwestern Univ EECS 351-1
 * "Intro to Computer Grapics".
 * --added "pushMatrix()" and "popMatrix()" member fcns to provide a push-down/
 *    pop-up stack for any Matrix4 object, useful for traversing scene graphs.
 * --added Quaternion class (at end; modified from early THREE.js library)
 * --added "printMe" member functions to print vector, matrix, and quaternions
 *	     in JavaScript console using "console.log()" function
 *
 * --This library"s "setXXX()" functions replace current matrix contents;
 *  (e.g. setIdentity(), setRotate(), etc) and its "concat()" and "XXX()" fcns
 *  (e.g. rotate(), translate(), scale() etc) multiply current matrix contents 
 * with a with the function"s newly-created matrix, e.g.:
 *  					[M_new] = [M_old][M_rotate] 
 * and returns matrix M_new.
 * 
 * MODIFIED 7/2025 by Dietrich Geisler for CS 351-1
 * --update of comments to conform to JSdoc style (https://jsdoc.app/)
 * --removed pushMatrix and popMatrix()
 * --fixes to Quaternion class
 * --concat has been fully replaced with multiply
 * --multiplyLeft introduced to help with C-style semantic logic
 * --rotate, translate, scale, etc adjusted to apply the operation to the current matrix
 *  that is, the new matrix is multiplied from the left now rather than the right
 * --updated Quaternion to be stylistically consistent with Matrix4
 */

/**
 * Utility function for floating-point comparison when needed
 * This isn"t ideal (e.g. we use a fixed tolerance), but it"s "good enough"
 * Usual reference: https://floating-point-gui.de/errors/comparison/
 * @param {Number} num1
 * @param {Number} num2
 * @param {Number} tolerance how wide of a range to permit (optional)
 * @returns {Boolean}
 */
function floatNearlyEqual(num1, num2, tolerance = 1e-8) {
    if (num1 == num2) {
        return true;
    }
    else if (num1 == 0 || num2 == 0) {
        return Math.abs(num1 - num2) < tolerance;
    }
    return Math.abs(num1 - num2) / (Math.abs(num1) + Math.abs(num2)) < tolerance;
}

/**
 * Helper function to check if obj is a Matrix4
 * Note that we only use the elements properties of obj to determine this for dumb reasons
 * @param {Object} obj 
 * @returns {Boolean} true if obj is probably a Matrix4, and false otherwise
 */
function isProbablyMatrix4(obj) {
    return typeof obj === "object"
        && obj.hasOwnProperty("elements")
        && obj.elements.length == 16;
}

/**
 * Helper function to check if obj is a Vector3
 * Note that we only use the elements properties of obj to determine this for dumb reasons
 * @param {Object} obj 
 * @returns {Boolean} true if obj is probably a Vector3, and false otherwise
 */
function isProbablyVector3(obj) {
    return typeof obj === "object"
        && obj.hasOwnProperty("elements")
        && obj.elements.length == 3;
}

/**
 * Helper function to check if obj is a Vector4
 * Note that we only use the elements properties of obj to determine this for dumb reasons
 * @param {Object} obj 
 * @returns {Boolean} true if obj is probably a Vector4, and false otherwise
 */
function isProbablyVector4(obj) {
    return typeof obj === "object"
        && obj.hasOwnProperty("elements")
        && obj.elements.length == 4;
}

/**
 * Helper function to check if obj is a Quaternion
 * Note that we only use the elements properties of obj to determine this for dumb reasons
 * @param {Object} obj 
 * @returns {Boolean} true if obj is probably a Quaternion, and false otherwise
 */
function isProbablyQuaternion(obj) {
    return typeof obj === "object"
        && obj.hasOwnProperty("x")
        && obj.hasOwnProperty("y")
        && obj.hasOwnProperty("z")
        && obj.hasOwnProperty("w");
}

/**
 * Constructor of Matrix4
 * If opt_src is specified, new matrix is initialized by the array opt_src.
 * Otherwise, new matrix is initialized as the identity matrix
 * 
 * Matrices are in column-first order
 * By index, the elements of a Matrix4 can be read as follows:
 * ---------------
 * | 0  4  8  12 |
 * | 1  5  9  13 |
 * | 2  6  10 14 |
 * | 3  7  11 15 |
 * ---------------
 * 
 * @param {Float32Array|Matrix4} opt_src source data (optional)
 */
let Matrix4 = function (opt_src = undefined) {
    let i, s, d;
    if (typeof opt_src === "undefined") {
        this.elements = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }
    else if (opt_src.elements !== undefined) {
        if (opt_src.elements.length !== 16) {
            throw `Invalid source for Matrix4 ${opt_src}`;
        }
        s = opt_src.elements;
        d = new Float32Array(16);
        for (i = 0; i < 16; ++i) {
            d[i] = s[i];
        }
        this.elements = d;
    }
    else {
        // assume iterable
        s = opt_src;
        d = new Float32Array(16);
        for (i = 0; i < 16; ++i) {
            d[i] = s[i];
        }
        this.elements = d;
    }
}

/**
 * Returns true if each element of this matrix is nearly equal to the other matrix
 * Returns false otherwise
 * @param {Matrix4} other
 * @param {Number} tolerance how wide of a range to consider equal (optional)
 * @returns {Boolean}
 */
Matrix4.prototype.nearlyEquals = function (other, tolerance = 1e-4) {
    if (typeof tolerance !== "number") {
        throw `Invalid argument to nearlyEquals: ${tolerance}`;
    }
    if (!isProbablyMatrix4(other)) {
        return false;
    }
    for (var i = 0; i < 16; i++) {
        if (!floatNearlyEqual(this.elements[i], other.elements[i], tolerance)) {
            return false;
        }
    }
    return true;
}

/**
 * Returns the string representation of this Matrix4
 * @param {Number} size the number of decimals to display
 * @returns {String}
 */
Matrix4.prototype.toString = function (size = 5) {
    if (typeof size !== "number") {
        throw `Invalid argument to toString: ${size}`;
    }
    let e = this.elements;
    let result = "\n-------------------------\n";
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j <= 8; j += 4) {
            result += e[i + j].toFixed(size) + "\t";
        }
        result += e[i + 12].toFixed(size) + "\n";
    }
    result += "-------------------------\n";
    return result
}

/**
 * Set the identity matrix.
 * @returns {Matrix4} this
 */
Matrix4.prototype.setIdentity = function () {
    let e = this.elements;
    e[0] = 1; e[4] = 0; e[8] = 0; e[12] = 0;
    e[1] = 0; e[5] = 1; e[9] = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
}

/**
 * Copy matrix.
 * @param {Matrix4} src source matrix
 * @returns {Matrix4} this
 */
Matrix4.prototype.set = function (src) {
    if (!isProbablyMatrix4(src)) {
        throw `Invalid argument to set: ${src}`;
    }
    let i, s, d;

    s = src.elements;
    d = this.elements;

    if (s === d) {		// do nothing if given "this" as arg.
        return;
    }

    for (i = 0; i < 16; ++i) {
        d[i] = s[i];
    }
    return this;
}

/**
 * Multiply this by the given matrix from the right.
 * that is, A.multiply(B) is the same as A * B
 * @param {Matrix4} other The multiply matrix
 * @returns {Matrix4} this
 */
Matrix4.prototype.multiply = function (other) {
    if (!isProbablyMatrix4(other)) {
        throw `Invalid argument to multiply: ${other}`;
    }
    let i, e, a, b, ai0, ai1, ai2, ai3;

    // name a and b
    a = this.elements;
    b = other.elements;

    // If a equals b by pointer equality, copy b.
    if (e === b) {
        b = new Float32Array(16);
        for (i = 0; i < 16; ++i) {
            b[i] = e[i];
        }
    }

    // Calculate a = a * b
    for (i = 0; i < 4; i++) {
        ai0 = a[i]; ai1 = a[i + 4]; ai2 = a[i + 8]; ai3 = a[i + 12];

        a[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
        a[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
        a[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
        a[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
    }

    return this;
}

/**
 * Multiply this by the given matrix from the left.
 * that is, A.multiplyLeft(B) is the same as B * A
 * @param {Matrix4} other The multiply matrix
 * @returns {Matrix4} this
 */
Matrix4.prototype.multiplyLeft = function (other) {
    if (!isProbablyMatrix4(other)) {
        throw `Invalid argument to multiplyLeft: ${other}`;
    }
    let i, a, b, ai0, ai1, ai2, ai3;

    // explicitly name a and b
    a = this.elements;
    b = other.elements;

    // If a equals b by pointer equality, copy b.
    if (a === b) {
        b = new Float32Array(16);
        for (i = 0; i < 16; ++i) {
            b[i] = a[i];
        }
    }

    // Calculate a = b * a
    for (i = 0; i < 16; i += 4) {
        ai0 = a[i]; ai1 = a[i + 1]; ai2 = a[i + 2]; ai3 = a[i + 3];

        a[i] = b[0] * ai0 + b[4] * ai1 + b[8] * ai2 + b[12] * ai3;
        a[i + 1] = b[1] * ai0 + b[5] * ai1 + b[9] * ai2 + b[13] * ai3;
        a[i + 2] = b[2] * ai0 + b[6] * ai1 + b[10] * ai2 + b[14] * ai3;
        a[i + 3] = b[3] * ai0 + b[7] * ai1 + b[11] * ai2 + b[15] * ai3;
    }

    return this;
}

/**
 * Multiply this by the given Vector3 to the left (assumes w==1)
 * @param {Vector3} vec The multiplied vector
 * @returns {Vector3} The result of multiplication
 */
Matrix4.prototype.multiplyVector3 = function (vec) {
    if (!isProbablyVector3(vec)) {
        throw `Invalid argument to multiplyVector3: ${vec}`;
    }
    let e = this.elements;
    let v = vec.elements;
    let result = new Vector3();
    let vo = result.elements;

    for (let i = 0; i < 3; i++) {
        // assumes that v.w is 1
        vo[i] = v[0] * e[i] + v[1] * e[i + 4] + v[2] * e[i + 8] + 1 * e[i + 12];
    }

    return result;
}

/**
 * Multiply this by the given Vector4 to the left
 * @param {Vector4} vec The multiplied vector
 * @returns {Vector4} The result of multiplication
 */
Matrix4.prototype.multiplyVector4 = function (vec) {
    if (!isProbablyVector4(vec)) {
        throw `Invalid argument to multiplyVector4: ${vec}`;
    }
    let e = this.elements;
    let v = vec.elements;
    let result = new Vector4();
    let vo = result.elements;

    for (let i = 0; i < 4; i++) {
        vo[i] = v[0] * e[i] + v[1] * e[i + 4] + v[2] * e[i + 8] + v[3] * e[i + 12];
    }

    return result;
}

/**
 * Returns the determinant of this matrix.
 * @returns {Number}
 */
Matrix4.prototype.determinant = function () {
    let result = 0;
    // since determinant(this) == determinant(this.transpose)
    // we can just letter row-first, which is easier to read (I think)
    let [a, b, c, d
        , e, f, g, h
        , i, j, k, l
        , m, n, o, p] = this.elements;

    // numbered such that the given element is the missing row/column
    // Each 3x3 matrix is given by
    // https://en.wikipedia.org/wiki/Determinant#3_%C3%97_3_matrices
    let a11 = f * k * p + g * l * n + h * j * o - h * k * n - g * j * p - f * l * o;
    let a12 = e * k * p + g * l * m + h * i * o - h * k * m - g * i * p - e * l * o;
    let a13 = e * j * p + f * l * m + h * i * n - h * j * m - f * i * p - e * l * n;
    let a14 = e * j * o + f * k * m + g * i * n - g * j * m - f * i * o - e * k * n;
    return a * a11 - b * a12 + c * a13 - d * a14;
}

/**
 * Transpose this matrix.
 * @returns {Matrix4} this
 */
Matrix4.prototype.transpose = function () {
    let e, t;

    e = this.elements;

    t = e[1]; e[1] = e[4]; e[4] = t;
    t = e[2]; e[2] = e[8]; e[8] = t;
    t = e[3]; e[3] = e[12]; e[12] = t;
    t = e[6]; e[6] = e[9]; e[9] = t;
    t = e[7]; e[7] = e[13]; e[13] = t;
    t = e[11]; e[11] = e[14]; e[14] = t;

    return this;
}

/**
 * Set this to be the inverse of the specified matrix.
 * If the specified matrix is not invertible, the behavior of this function is undefined
 * @param {Matrix4} other The source matrix
 * @returns {Matrix4} this
 */
Matrix4.prototype.setInverseOf = function (other) {
    if (!isProbablyMatrix4(other)) {
        throw `Invalid argument to setInverseOf: ${other}`;
    }
    let i, s, d, inv, det;

    s = other.elements;
    d = this.elements;
    inv = new Float32Array(16);

    inv[0] = s[5] * s[10] * s[15] - s[5] * s[11] * s[14] - s[9] * s[6] * s[15]
        + s[9] * s[7] * s[14] + s[13] * s[6] * s[11] - s[13] * s[7] * s[10];
    inv[4] = - s[4] * s[10] * s[15] + s[4] * s[11] * s[14] + s[8] * s[6] * s[15]
        - s[8] * s[7] * s[14] - s[12] * s[6] * s[11] + s[12] * s[7] * s[10];
    inv[8] = s[4] * s[9] * s[15] - s[4] * s[11] * s[13] - s[8] * s[5] * s[15]
        + s[8] * s[7] * s[13] + s[12] * s[5] * s[11] - s[12] * s[7] * s[9];
    inv[12] = - s[4] * s[9] * s[14] + s[4] * s[10] * s[13] + s[8] * s[5] * s[14]
        - s[8] * s[6] * s[13] - s[12] * s[5] * s[10] + s[12] * s[6] * s[9];

    inv[1] = - s[1] * s[10] * s[15] + s[1] * s[11] * s[14] + s[9] * s[2] * s[15]
        - s[9] * s[3] * s[14] - s[13] * s[2] * s[11] + s[13] * s[3] * s[10];
    inv[5] = s[0] * s[10] * s[15] - s[0] * s[11] * s[14] - s[8] * s[2] * s[15]
        + s[8] * s[3] * s[14] + s[12] * s[2] * s[11] - s[12] * s[3] * s[10];
    inv[9] = - s[0] * s[9] * s[15] + s[0] * s[11] * s[13] + s[8] * s[1] * s[15]
        - s[8] * s[3] * s[13] - s[12] * s[1] * s[11] + s[12] * s[3] * s[9];
    inv[13] = s[0] * s[9] * s[14] - s[0] * s[10] * s[13] - s[8] * s[1] * s[14]
        + s[8] * s[2] * s[13] + s[12] * s[1] * s[10] - s[12] * s[2] * s[9];

    inv[2] = s[1] * s[6] * s[15] - s[1] * s[7] * s[14] - s[5] * s[2] * s[15]
        + s[5] * s[3] * s[14] + s[13] * s[2] * s[7] - s[13] * s[3] * s[6];
    inv[6] = - s[0] * s[6] * s[15] + s[0] * s[7] * s[14] + s[4] * s[2] * s[15]
        - s[4] * s[3] * s[14] - s[12] * s[2] * s[7] + s[12] * s[3] * s[6];
    inv[10] = s[0] * s[5] * s[15] - s[0] * s[7] * s[13] - s[4] * s[1] * s[15]
        + s[4] * s[3] * s[13] + s[12] * s[1] * s[7] - s[12] * s[3] * s[5];
    inv[14] = - s[0] * s[5] * s[14] + s[0] * s[6] * s[13] + s[4] * s[1] * s[14]
        - s[4] * s[2] * s[13] - s[12] * s[1] * s[6] + s[12] * s[2] * s[5];

    inv[3] = - s[1] * s[6] * s[11] + s[1] * s[7] * s[10] + s[5] * s[2] * s[11]
        - s[5] * s[3] * s[10] - s[9] * s[2] * s[7] + s[9] * s[3] * s[6];
    inv[7] = s[0] * s[6] * s[11] - s[0] * s[7] * s[10] - s[4] * s[2] * s[11]
        + s[4] * s[3] * s[10] + s[8] * s[2] * s[7] - s[8] * s[3] * s[6];
    inv[11] = - s[0] * s[5] * s[11] + s[0] * s[7] * s[9] + s[4] * s[1] * s[11]
        - s[4] * s[3] * s[9] - s[8] * s[1] * s[7] + s[8] * s[3] * s[5];
    inv[15] = s[0] * s[5] * s[10] - s[0] * s[6] * s[9] - s[4] * s[1] * s[10]
        + s[4] * s[2] * s[9] + s[8] * s[1] * s[6] - s[8] * s[2] * s[5];

    det = s[0] * inv[0] + s[1] * inv[4] + s[2] * inv[8] + s[3] * inv[12];
    if (det === 0) {
        return this;
    }

    det = 1 / det;
    for (i = 0; i < 16; i++) {
        d[i] = inv[i] * det;
    }

    return this;
}

/**
 * Calculate the inverse matrix of this, and set to this.
 * @returns {Matrix4} this
 */
Matrix4.prototype.invert = function () {
    return this.setInverseOf(this);
}

/**
 * Set the matrix for scaling.
 * @param {Number} x The scale factor along the X axis
 * @param {Number} y The scale factor along the Y axis
 * @param {Number} z The scale factor along the Z axis
 * @returns {Matrix4} this
 */
Matrix4.prototype.setScale = function (x, y, z) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to setScale: ${value}`;
        }
    }
    checkNum(x);
    checkNum(y);
    checkNum(z);

    let e = this.elements;
    e[0] = x; e[4] = 0; e[8] = 0; e[12] = 0;
    e[1] = 0; e[5] = y; e[9] = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = z; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
}

/**
 * Multiply the matrix for scaling from the left.
 * In other words, append scaling to our existing transformations
 * @param {Number} x The scale factor along the X axis
 * @param {Number} y The scale factor along the Y axis
 * @param {Number} z The scale factor along the Z axis
 * @returns {Matrix4} this
 */
Matrix4.prototype.scale = function (x, y, z) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to scale: ${value}`;
        }
        return true;
    }
    checkNum(x);
    checkNum(y);
    checkNum(z);

    let e = this.elements;
    e[0] *= x; e[4] *= x; e[8] *= x; e[12] *= x;
    e[1] *= y; e[5] *= y; e[9] *= y; e[13] *= y;
    e[2] *= z; e[6] *= z; e[10] *= z; e[14] *= z;
    return this;
}

/**
 * Set the matrix for translation.
 * @param {Number} x The X value of a translation.
 * @param {Number} y The Y value of a translation.
 * @param {Number} z The Z value of a translation.
 * @returns {Matrix4} this
 */
Matrix4.prototype.setTranslate = function (x, y, z) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to setTranslate: ${value}`;
        }
        return true;
    }
    checkNum(x);
    checkNum(y);
    checkNum(z);

    let e = this.elements;
    e[0] = 1; e[4] = 0; e[8] = 0; e[12] = x;
    e[1] = 0; e[5] = 1; e[9] = 0; e[13] = y;
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = z;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
}

/**
 * Multiply the matrix for translation from the left.
 * @param {Number} x The X value of a translation.
 * @param {Number} y The Y value of a translation.
 * @param {Number} z The Z value of a translation.
 * @returns {Matrix4} this
 */
Matrix4.prototype.translate = function (x, y, z) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to translate: ${value}`;
        }
        return true;
    }
    checkNum(x);
    checkNum(y);
    checkNum(z);

    let e = this.elements;
    for (i = 0; i < 16; i += 4) {
        e[i + 0] += e[i + 3] * x;
        e[i + 1] += e[i + 3] * y;
        e[i + 2] += e[i + 3] * z;
    }
    return this;
}

/**
 * Set the matrix for rotation.
 * The vector of rotation axis may not be normalized.
 * @param {Number} angle The angle of rotation (degrees)
 * @param {Number} x The X coordinate of vector of rotation axis.
 * @param {Number} y The Y coordinate of vector of rotation axis.
 * @param {Number} z The Z coordinate of vector of rotation axis.
 * @returns {Matrix4} this
 */
Matrix4.prototype.setRotate = function (angle, x, y, z) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to rotate: or setRotate ${value}`;
        }
        return true;
    }
    checkNum(angle);
    checkNum(x);
    checkNum(y);
    checkNum(z);

    let e, s, c, len, rlen, nc, xy, yz, zx, xs, ys, zs;

    angle = Math.PI * angle / 180;
    e = this.elements;

    s = Math.sin(angle);
    c = Math.cos(angle);

    if (0 !== x && 0 === y && 0 === z) {
        // Rotation around X axis
        if (x < 0) {
            s = -s;
        }
        e[0] = 1; e[4] = 0; e[8] = 0; e[12] = 0;
        e[1] = 0; e[5] = c; e[9] = -s; e[13] = 0;
        e[2] = 0; e[6] = s; e[10] = c; e[14] = 0;
        e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    } else if (0 === x && 0 !== y && 0 === z) {
        // Rotation around Y axis
        if (y < 0) {
            s = -s;
        }
        e[0] = c; e[4] = 0; e[8] = s; e[12] = 0;
        e[1] = 0; e[5] = 1; e[9] = 0; e[13] = 0;
        e[2] = -s; e[6] = 0; e[10] = c; e[14] = 0;
        e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    } else if (0 === x && 0 === y && 0 !== z) {
        // Rotation around Z axis
        if (z < 0) {
            s = -s;
        }
        e[0] = c; e[4] = -s; e[8] = 0; e[12] = 0;
        e[1] = s; e[5] = c; e[9] = 0; e[13] = 0;
        e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0;
        e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    } else {
        // Rotation around another axis
        len = Math.sqrt(x * x + y * y + z * z);
        if (len !== 1) {
            rlen = 1 / len;
            x *= rlen;
            y *= rlen;
            z *= rlen;
        }
        nc = 1 - c;
        xy = x * y;
        yz = y * z;
        zx = z * x;
        xs = x * s;
        ys = y * s;
        zs = z * s;

        e[0] = x * x * nc + c;
        e[1] = xy * nc + zs;
        e[2] = zx * nc - ys;
        e[3] = 0;

        e[4] = xy * nc - zs;
        e[5] = y * y * nc + c;
        e[6] = yz * nc + xs;
        e[7] = 0;

        e[8] = zx * nc + ys;
        e[9] = yz * nc - xs;
        e[10] = z * z * nc + c;
        e[11] = 0;

        e[12] = 0;
        e[13] = 0;
        e[14] = 0;
        e[15] = 1;
    }

    return this;
}
/**
 * Multiply the matrix for rotation from the left.
 * The vector of rotation axis may not be normalized.
 * @param {Number} angle The angle of rotation (degrees)
 * @param {Number} x The X coordinate of vector of rotation axis.
 * @param {Number} y The Y coordinate of vector of rotation axis.
 * @param {Number} z The Z coordinate of vector of rotation axis.
 * @returns {Matrix4} this
 */
Matrix4.prototype.rotate = function (angle, x, y, z) {
    return this.multiplyLeft(new Matrix4().setRotate(angle, x, y, z));
}

/**
 * Set this to be the orthographic projection matrix.
 * @param {Number} left The coordinate of the left of clipping plane.
 * @param {Number} right The coordinate of the right of clipping plane.
 * @param {Number} bottom The coordinate of the bottom of clipping plane.
 * @param {Number} top The coordinate of the top top clipping plane.
 * @param {Number} near The distances to the nearer depth clipping plane. This value is minus if the plane is to be behind the viewer.
 * @param {Number} far The distances to the farther depth clipping plane. This value is minus if the plane is to be behind the viewer.
 * @returns {Matrix4} this
 */
Matrix4.prototype.setOrtho = function (left, right, bottom, top, near, far) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to ortho: or setOrtho ${value}`;
        }
        return true;
    }
    if (!checkNum(left)) { return this; }
    if (!checkNum(right)) { return this; }
    if (!checkNum(bottom)) { return this; }
    if (!checkNum(top)) { return this; }
    if (!checkNum(near)) { return this; }
    if (!checkNum(far)) { return this; }
    let e, rw, rh, rd;

    if (left === right || bottom === top || near === far) {
        throw `null fullstrum`;
    }

    rw = 1 / (right - left);
    rh = 1 / (top - bottom);
    rd = 1 / (far - near);

    e = this.elements;

    e[0] = 2 * rw;
    e[1] = 0;
    e[2] = 0;
    e[3] = 0;

    e[4] = 0;
    e[5] = 2 * rh;
    e[6] = 0;
    e[7] = 0;

    e[8] = 0;
    e[9] = 0;
    e[10] = -2 * rd;
    e[11] = 0;

    e[12] = -(right + left) * rw;
    e[13] = -(top + bottom) * rh;
    e[14] = -(far + near) * rd;
    e[15] = 1;

    return this;
}

/**
 * Multiply the orthographic projection matrix from the left.
 * @param {Number} left The coordinate of the left of clipping plane.
 * @param {Number} right The coordinate of the right of clipping plane.
 * @param {Number} bottom The coordinate of the bottom of clipping plane.
 * @param {Number} top The coordinate of the top top clipping plane.
 * @param {Number} near The distances to the nearer depth clipping plane. This value is minus if the plane is to be behind the viewer.
 * @param {Number} far The distances to the farther depth clipping plane. This value is minus if the plane is to be behind the viewer.
 * @returns {Matrix4} this
 */
Matrix4.prototype.ortho = function (left, right, bottom, top, near, far) {
    return this.multiplyLeft(new Matrix4().setOrtho(left, right, bottom, top, near, far));
}

/**
 * Set this to be the perspective projection matrix.
 * @param {Number} left The coordinate of the left of clipping plane.
 * @param {Number} right The coordinate of the right of clipping plane.
 * @param {Number} bottom The coordinate of the bottom of clipping plane.
 * @param {Number} top The coordinate of the top top clipping plane.
 * @param {Number} near The distances to the nearer depth clipping plane. This value must be positive
 * @param {Number} far The distances to the farther depth clipping plane. This value must be positive
 * @returns {Matrix4} this
 */
Matrix4.prototype.setFrustum = function (left, right, bottom, top, near, far) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to fustrum: or setFrustum ${value}`;
        }
        return true;
    }
    if (!checkNum(left)) { return this; }
    if (!checkNum(right)) { return this; }
    if (!checkNum(bottom)) { return this; }
    if (!checkNum(top)) { return this; }
    if (!checkNum(near)) { return this; }
    if (!checkNum(far)) { return this; }
    let e, rw, rh, rd;

    if (left === right || top === bottom || near === far) {
        throw "null frustum";
    }
    if (near <= 0) {
        throw "near <= 0";
    }
    if (far <= 0) {
        throw "far <= 0";
    }

    rw = 1 / (right - left);
    rh = 1 / (top - bottom);
    rd = 1 / (far - near);

    e = this.elements;

    e[0] = 2 * near * rw;
    e[1] = 0;
    e[2] = 0;
    e[3] = 0;

    e[4] = 0;
    e[5] = 2 * near * rh;
    e[6] = 0;
    e[7] = 0;

    e[8] = (right + left) * rw;
    e[9] = (top + bottom) * rh;
    e[10] = -(far + near) * rd;
    e[11] = -1;

    e[12] = 0;
    e[13] = 0;
    e[14] = -2 * near * far * rd;
    e[15] = 0;

    return this;
}

/**
 * Multiply the perspective projection matrix from the left.
 * @param {Number} left The coordinate of the left of clipping plane.
 * @param {Number} right The coordinate of the right of clipping plane.
 * @param {Number} bottom The coordinate of the bottom of clipping plane.
 * @param {Number} top The coordinate of the top top clipping plane.
 * @param {Number} near The distances to the nearer depth clipping plane. This value must be positive
 * @param {Number} far The distances to the farther depth clipping plane. This value must be positive
 * @returns {Matrix4} this
 */
Matrix4.prototype.frustum = function (left, right, bottom, top, near, far) {
    return this.multiplyLeft(new Matrix4().setFrustum(left, right, bottom, top, near, far));
}

/**
 * Set this to be the perspective projection matrix by fovy and aspect.
 * @param {Number} fovy The angle in degrees between the upper and lower sides of the frustum.
 * @param {Number} aspect The aspect ratio of the frustum. (width/height)
 * @param {Number} near The distances to the nearer depth clipping plane. This value must be positive
 * @param {Number} far The distances to the farther depth clipping plane. This value must be positive
 * @returns {Matrix4} this
 */
Matrix4.prototype.setPerspective = function (fovy, aspect, near, far) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to perspective: or setPerspective ${value}`;
        }
        return true;
    }
    if (!checkNum(fovy)) { return this; }
    if (!checkNum(aspect)) { return this; }
    if (!checkNum(near)) { return this; }
    if (!checkNum(far)) { return this; }
    let e, rd, s, ct;

    if (near === far || aspect === 0) {
        throw 'null frustum';
    }
    if (near <= 0) {
        throw "near <= 0";
    }
    if (far <= 0) {
        throw "far <= 0";
    }

    fovy = Math.PI * fovy / 180 / 2;
    s = Math.sin(fovy);
    if (s === 0) {
        throw "null frustum";
    }

    rd = 1 / (far - near);
    ct = Math.cos(fovy) / s;

    e = this.elements;

    e[0] = ct / aspect;
    e[1] = 0;
    e[2] = 0;
    e[3] = 0;

    e[4] = 0;
    e[5] = ct;
    e[6] = 0;
    e[7] = 0;

    e[8] = 0;
    e[9] = 0;
    e[10] = -(far + near) * rd;
    e[11] = -1;

    e[12] = 0;
    e[13] = 0;
    e[14] = -2 * near * far * rd;
    e[15] = 0;

    return this;
}

/**
 * Multiply the perspective projection matrix from the left.
 * @param {Number} fovy The angle in degrees between the upper and lower sides of the frustum.
 * @param {Number} aspect The aspect ratio of the frustum. (width/height)
 * @param {Number} near The distances to the nearer depth clipping plane. This value must be positive
 * @param {Number} far The distances to the farther depth clipping plane. This value must be positive
 * @returns {Matrix4} this
 */
Matrix4.prototype.perspective = function (fovy, aspect, near, far) {
    return this.multiplyLeft(new Matrix4().setPerspective(fovy, aspect, near, far));
}

/**
 * Sets the lookat of this matrix
 * @param {Vector3} eye: the location of the looking object
 * @param {Vector3} target: the location of the point we"re looking at
 * @param {Vector3} up: the unit direction "up" relative our camera (often (0, 0, 1))  
 * @returns {Matrix4} this
 */
Matrix4.prototype.setLookAt = function (eye, target, up) {
    function checkVec(value) {
        if (!isProbablyVector3(value)) {
            throw `Invalid argument to lookAt: or setLookAt ${value}`;
        }
        return true;
    }
    if (!checkVec(eye)) { return this; }
    if (!checkVec(target)) { return this; }
    if (!checkVec(up)) { return this; }

    let e, fx, fy, fz, rlf, sx, sy, sz, rls, ux, uy, uz;

    let eyeX = eye.elements[0];
    let eyeY = eye.elements[1];
    let eyeZ = eye.elements[2];
    let targetX = target.elements[0];
    let targetY = target.elements[1];
    let targetZ = target.elements[2];
    let upX = up.elements[0];
    let upY = up.elements[1];
    let upZ = up.elements[2];

    fx = targetX - eyeX;
    fy = targetY - eyeY;
    fz = targetZ - eyeZ;

    // Normalize f.
    rlf = 1 / Math.sqrt(fx * fx + fy * fy + fz * fz);
    fx *= rlf;
    fy *= rlf;
    fz *= rlf;

    // Calculate cross product of f and up.
    sx = fy * upZ - fz * upY;
    sy = fz * upX - fx * upZ;
    sz = fx * upY - fy * upX;

    // Normalize s.
    rls = 1 / Math.sqrt(sx * sx + sy * sy + sz * sz);
    sx *= rls;
    sy *= rls;
    sz *= rls;

    // Calculate cross product of s and f.
    ux = sy * fz - sz * fy;
    uy = sz * fx - sx * fz;
    uz = sx * fy - sy * fx;

    // Set to this.
    e = this.elements;
    e[0] = sx;
    e[1] = ux;
    e[2] = -fx;
    e[3] = 0;

    e[4] = sy;
    e[5] = uy;
    e[6] = -fy;
    e[7] = 0;

    e[8] = sz;
    e[9] = uz;
    e[10] = -fz;
    e[11] = 0;

    e[12] = 0;
    e[13] = 0;
    e[14] = 0;
    e[15] = 1;

    // Translate.
    this.multiply(new Matrix4().setTranslate(-eyeX, -eyeY, -eyeZ));
    return this;
}

/**
 * Multiply by the lookat matrix to the left
 * @param {Vector3} eye: the location of the camera
 * @param {Vector3} center: the location of the point we"re looking at
 * @param {Vector3} up: the unit direction "up" relative our camera (often (0, 0, 1))  
 * @returns {Matrix4} this
 */
Matrix4.prototype.lookAt = function (eye, center, up) {
    return this.multiplyLeft(new Matrix4().setLookAt(eye, center, up));
}

/**
 * Multiply the matrix for project vertex to plane from the left.
 * @param {Float32Array} plane The array[A, B, C, D] of the equation of plane "Ax + By + Cz + D = 0".
 * @param {Vector4} light The vector which stored coordinates of the light. if light[3]=0, treated as parallel light.
 * @returns {Matrix4} this
 */
Matrix4.prototype.dropShadow = function (plane, light) {
    if (typeof plane !== "object"
        || plane.hasOwnProperty("length")
        || plane.length != 4
    ) {
        throw `Invalid argument to dropShadow: ${plane}`;
    }
    if (!isProbablyVector4(light)) {
        throw `Invalid argument to dropShadow: ${light}`;
    }

    let mat = new Matrix4();
    let e = mat.elements;
    let loc = light.elements

    let dot = plane[0] * loc[0] + plane[1] * loc[1] + plane[2] * loc[2] + plane[3] * loc[3];

    e[0] = dot - loc[0] * plane[0];
    e[1] = - loc[1] * plane[0];
    e[2] = - loc[2] * plane[0];
    e[3] = - loc[3] * plane[0];

    e[4] = - loc[0] * plane[1];
    e[5] = dot - loc[1] * plane[1];
    e[6] = - loc[2] * plane[1];
    e[7] = - loc[3] * plane[1];

    e[8] = - loc[0] * plane[2];
    e[9] = - loc[1] * plane[2];
    e[10] = dot - loc[2] * plane[2];
    e[11] = - loc[3] * plane[2];

    e[12] = - loc[0] * plane[3];
    e[13] = - loc[1] * plane[3];
    e[14] = - loc[2] * plane[3];
    e[15] = dot - loc[3] * plane[3];

    return this.multiplyLeft(mat);
}

/**
 * Multiply the matrix for project vertex to plane from the left.(Projected by parallel light.)
 * @param {Vector3} norm: The normal vector of the plane.(Not necessary to be normalized.)
 * @param {Vector3} plane: The coordinate of arbitrary points on a plane.
 * @param {Vector3} light: The vector of the direction of light.(Not necessary to be normalized.)
 * @returns this
 */
Matrix4.prototype.dropShadowDirectionally = function (norm, plane, light) {
    if (!isProbablyVector3(norm)) {
        throw `Invalid argument to dropShadowDirectionally: ${norm}`;
    }
    if (!isProbablyVector3(plane)) {
        throw `Invalid argument to dropShadowDirectionally: ${plane}`;
    }
    if (!isProbablyVector3(light)) {
        throw `Invalid argument to dropShadowDirectionally: ${light}`;
    }

    normX = norm.elements[0];
    normY = norm.elements[1];
    normZ = norm.elements[2];
    planeX = plane.elements[0];
    planeY = plane.elements[1];
    planeZ = plane.elements[2];
    lightX = light.elements[0];
    lightY = light.elements[1];
    lightZ = light.elements[2];

    let a = planeX * normX + planeY * normY + planeZ * normZ;
    return this.dropShadow([normX, normY, normZ, -a], [lightX, lightY, lightZ, 0]);
}

/**
 * Create rotation matrix from a given !UNIT-LENGTH! quaternion.
 * CAUTION!  forms WEIRD matrices from quaternions of other lengths!
 * -- Jack Tumblin 2/2014: from "Math for 3D Game Programmng and CG"
 *													by Jed Lengyel, 34r Ed., pg. 91.
 * @param {Number} qw the quaternion"s "real" coordinate
 * @param {Number} qx the quaternion"s imaginary-i coord.
 * @param {Number} qy the quaternion"s imaginary-j coord.
 * @param {Number} qz the quaternion"s imaginary-k coord.
 * @returns {Matrix4} this
 */
Matrix4.prototype.setFromQuatXYZW = function (qx, qy, qz, qw) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to setFromQuatXYZW: ${value}`;
        }
        return true;
    }
    if (!checkNum(qx)) { return this; }
    if (!checkNum(qy)) { return this; }
    if (!checkNum(qz)) { return this; }
    if (!checkNum(qw)) { return this; }
    let e = this.elements;
    e[0] = 1 - 2 * qy * qy - 2 * qz * qz; e[4] = 2 * qx * qy - 2 * qw * qz; e[8] = 2 * qx * qz + 2 * qw * qy; e[12] = 0;
    e[1] = 2 * qx * qy + 2 * qw * qz; e[5] = 1 - 2 * qx * qx - 2 * qz * qz; e[9] = 2 * qy * qz - 2 * qw * qx; e[13] = 0;
    e[2] = 2 * qx * qz - 2 * qw * qy; e[6] = 2 * qy * qz + 2 * qw * qx; e[10] = 1 - 2 * qx * qx - 2 * qy * qy; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
}

/**
 * Create rotation matrix from a given !UNIT-LENGTH! quaternion.
 * CAUTION!  forms WEIRD matrices from quaternions of other lengths!
 * -- Jack Tumblin 2/2014: from "Math for 3D Game Programmng and CG"
 *													by Jed Lengyel, 34r Ed., pg. 91.
 * @param {Quaternion} q
 * @returns {Matrix4} this
 */
Matrix4.prototype.setFromQuaternion = function (q) {
    if (!isProbablyQuaternion(q)) {
        throw `Invalid argument to setFromQuaternion: ${q}`;
    }
    this.setFromQuatXYZW(q.x, q.y, q.z, q.w);
    return this;
}

/**
 * print matrix contents in console window:
 *			(J. Tumblin 2014.02.15; updated 2018.02.01)
 * @param {string} opt_src: optional string representation
 */
Matrix4.prototype.printMe = function (opt_src = undefined) {
    let res = 5;
    let e = this.elements;   // why do this? just to make code more readable...
    if (opt_src && typeof opt_src === "string") {  // called w/ string argument?
        // YES! use that string as our label:
        console.log("-------------------", opt_src, "-------------------------");
        console.log(e[0].toFixed(res), "\t", e[4].toFixed(res), "\t",
            e[8].toFixed(res), "\t", e[12].toFixed(res));
        console.log(e[1].toFixed(res), "\t", e[5].toFixed(res), "\t",
            e[9].toFixed(res), "\t", e[13].toFixed(res));
        console.log(e[2].toFixed(res), "\t", e[6].toFixed(res), "\t",
            e[10].toFixed(res), "\t", e[14].toFixed(res));
        console.log(e[3].toFixed(res), "\t", e[7].toFixed(res), "\t",
            e[11].toFixed(res), "\t", e[15].toFixed(res));
        console.log("-------------------", opt_src, "(end)--------------------\n");
    }
    else {   // No. use default labels:
        console.log("----------------------4x4 Matrix----------------------------");
        console.log(e[0].toFixed(res), "\t", e[4].toFixed(res), "\t",
            e[8].toFixed(res), "\t", e[12].toFixed(res));
        console.log(e[1].toFixed(res), "\t", e[5].toFixed(res), "\t",
            e[9].toFixed(res), "\t", e[13].toFixed(res));
        console.log(e[2].toFixed(res), "\t", e[6].toFixed(res), "\t",
            e[10].toFixed(res), "\t", e[14].toFixed(res));
        console.log(e[3].toFixed(res), "\t", e[7].toFixed(res), "\t",
            e[11].toFixed(res), "\t", e[15].toFixed(res));
        console.log("----------------------4x4 Matrix (end)----------------------\n");
    }
}

/**====================Vector3===============================================

/**
 * Constructor of Vector3
 * If opt_src is specified, new vector is initialized by opt_src 
 *   opt_src may be an Array, Vector3, Vector4, or Number
 * y and z are only used if opt_src is a Number
 * Otherwise, constructs the zero vector
 * @param {Float32Array|Vector3|Number} opt_src source vector (optional)
 * @param {}
 */
let Vector3 = function (opt_src = undefined, y = 0, z = 0) {
    let v = new Float32Array(3);
    if (typeof opt_src !== "undefined") {
        if (opt_src.hasOwnProperty("elements")) {
            if ([3, 4].includes(opt_src.elements.length)) {
                let e = opt_src.elements;
                v[0] = e[0]; v[1] = e[1]; v[2] = e[2];
            }
            else {
                throw `Invalid source for Vector3 ${opt_src}`;
            }
        }
        else if (typeof opt_src === "number") {

            let x = opt_src;
            v[0] = x; v[1] = y; v[2] = z;
        }
        else if (opt_src) { // assume an array-like object
            v[0] = opt_src[0]; v[1] = opt_src[1]; v[2] = opt_src[2];
        }
    }
    this.elements = v;
}

/**
 * Returns true if each element of this is nearly equal to other
 * Returns false otherwise
 * @param {Vector3} other
 * @param {Number} tolerance how wide of a range to consider equal (optional) 
 * @returns {Boolean}
 */
Vector3.prototype.nearlyEquals = function (other, tolerance = 1e-8) {
    if (typeof tolerance !== "number") {
        throw `Invalid argument to nearlyEquals: ${tolerance}`;
    }
    if (!isProbablyVector3(other)) {
        return false;
    }
    for (var i = 0; i < 3; i++) {
        if (!floatNearlyEqual(this.elements[i], other.elements[i], tolerance)) {
            return false;
        }
    }
    return true;
}

/** D. Geisler 2025
  * Returns the string representation of Vector3
  * @param {Number} size the number of decimals to display
  * @returns {String}
  */
Vector3.prototype.toString = function (size = 5) {
    if (typeof size !== "number") {
        throw `Invalid argument to toString: ${size}`;
    }
    let result = "Vector3(";
    result += this.elements[0].toFixed(size) + ", ";
    result += this.elements[1].toFixed(size) + ", ";
    result += this.elements[2].toFixed(size) + ")";
    return result;
}

/**
 * Returns the magnitude (i.e. length) of this vector
 * @returns {Number}
 */
Vector3.prototype.magnitude = function () {
    let a = this.elements[0];
    let b = this.elements[1];
    let c = this.elements[2];
    return Math.sqrt(a * a + b * b + c * c);
}

/**
  * Normalize this Vector in-place and return the result
  * @returns {Vector3} this
  */
Vector3.prototype.normalize = function () {
    let v = this.elements;
    let len = this.magnitude();
    // zero case
    if (floatNearlyEqual(len, 0.0)) {
        v[0] = 0; v[1] = 0; v[2] = 0;
        return this;
    }
    // general case
    v[0] = v[0] / len;
    v[1] = v[1] / len;
    v[2] = v[2] / len;
    return this;
}

/**
 * Returns a copy of this vector with each element multiplied by "amount"
 * @param {Number} amount 
 * @returns {Vector3}
 */
Vector3.prototype.scaled = function (amount) {
    if (typeof amount !== "number") {
        throw `Invalid argument to scaled: ${amount}`;
    }
    let result = new Vector3(this.elements);
    for (let i = 0; i < 3; i++) {
        result.elements[i] *= amount;
    }
    return result;
}

/**
 * Returns a copy of this vector added component-wise to "other"
 * @param {Vector3} other 
 * @returns {Vector3}
 */
Vector3.prototype.add = function (other) {
    if (!isProbablyVector3(other)) {
        throw `Invalid argument to add: ${other}`;
    }
    let result = new Vector3(this.elements);
    for (let i = 0; i < 3; i++) {
        result.elements[i] += other.elements[i];
    }
    return result;
}

/** J. Tumblin 2018.02.13
  * Calculates and returns the (scalar) dot-product of the two Vector3 objects
  * @param {Vector3} other: the Vector3 to take the dot product with
  * @returns {Number}
  */
Vector3.prototype.dot = function (other) {
    if (!isProbablyVector3(other)) {
        throw `Invalid argument to dot: ${other}`;
    }
    let vA = this.elements; // short-hand for the calling object
    let vB = other.elements;
    return vA[0] * vB[0] + vA[1] * vB[1] + vA[2] * vB[2];  // compute dot-product
}

/** J. Tumblin 2018.02.13
  * Returns Vector3 cross-product of current object and argument
  * Neither this nor the other vector are modified in this calculation 
  * Note that cross products are not commutative
  * a.cross(b) is equivalent to a x b
  * @param {Vector3} opt_src: the Vector3 to cross product with
  * @returns {Vector3}
  */
Vector3.prototype.cross = function (other) {
    if (!isProbablyVector3(other)) {
        throw `Invalid argument to cross: ${other}`;
    }
    let vA = this.elements;   // short-hand for the calling object
    let ans = new Vector3([0.0, 0.0, 0.0]);  // initialize to zero vector 
    let vC = ans.elements;    // get the Float32Array contents of "ans"
    let vB = other.elements;
    // compute cross-product
    vC[0] = vA[1] * vB[2] - vA[2] * vB[1];  // Cx = Ay*Bz - Az*By
    vC[1] = vA[2] * vB[0] - vA[0] * vB[2];  // Cy = Az*Bx - Ax*Bz
    vC[2] = vA[0] * vB[1] - vA[1] * vB[0];  // Cz = Ax*By - Ay*Bx
    return ans;
}

/** J. Tumblin 2018.02.01
  * Print formatted contents of Vector3 to the console.
  * @param {String} opt_src an optional string argument to be formatted directly
  */
Vector3.prototype.printMe = function (opt_src = undefined) {
    let res = 5;
    if (opt_src && typeof opt_src === "string") {
        console.log(opt_src, ":",
            this.elements[0].toFixed(res), "\t",
            this.elements[1].toFixed(res), "\t",
            this.elements[2].toFixed(res), "\n");
    }
    else {
        console.log("Vector3:",
            this.elements[0].toFixed(res), "\t",
            this.elements[1].toFixed(res), "\t",
            this.elements[2].toFixed(res), "\n");
    }
}

/**====================Vector4===============================================

/**
 * Constructor of Vector4
 * If opt_src is specified, new vector is initialized by opt_src 
 *   opt_src may be an Array, Vector3, Vector4, or Number
 * y, z, and w are only used if opt_src is a Number
 * Otherwise, constructs the zero vector
 * @param {Float32Array} opt_src source array (optional)
 */
let Vector4 = function (opt_src = undefined, y = 0, z = 0, w = 0) {
    let v = new Float32Array(4);
    if (typeof opt_src !== "undefined") {
        if (opt_src.hasOwnProperty("elements")) {
            if (opt_src.elements.length === 3) {
                let e = opt_src.elements;
                v[0] = e[0]; v[1] = e[1]; v[2] = e[2];
            }
            else if (opt_src.elements.length === 4) {
                let e = opt_src.elements;
                v[0] = e[0]; v[1] = e[1]; v[2] = e[2]; v[3] = e[3];
            }
            else {
                throw `Invalid source for Vector4 ${opt_src}`;
            }
        }
        else if (typeof opt_src === "number") {
            let x = opt_src;
            v[0] = x; v[1] = y; v[2] = z; v[3] = w;
        }
        else if (opt_src) { // assume an array-like object
            v[0] = opt_src[0]; v[1] = opt_src[1];
            v[2] = opt_src[2]; v[3] = opt_src[3];
        }
    }
    this.elements = v;
}

/**
 * Returns true if each element of this is nearly equal to other
 * Returns false otherwise
 * @param {Vector4} other
 * @param {Number} tolerance how wide of a range to consider equal (optional)
 * @returns {Boolean}
 */
Vector4.prototype.nearlyEquals = function (other, tolerance = 1e-8) {
    if (typeof tolerance !== "number") {
        throw `Invalid argument to nearlyEquals: ${tolerance}`;
    }
    if (!isProbablyVector4(other)) {
        return false;
    }
    for (var i = 0; i < 4; i++) {
        if (!floatNearlyEqual(this.elements[i], other.elements[i], tolerance)) {
            return false;
        }
    }
    return true;
}

/** D. Geisler 2025
  * Returns the string representation of Vector4
  * @param {Number} size the number of decimals to display
  * @returns {String}
  */
Vector4.prototype.toString = function (size = 5) {
    if (typeof size !== "number") {
        throw `Invalid argument to toString: ${size}`;
    }
    let result = "Vector4(";
    result += this.elements[0].toFixed(size) + ", ";
    result += this.elements[1].toFixed(size) + ", ";
    result += this.elements[2].toFixed(size) + ", ";
    result += this.elements[3].toFixed(size) + ")";
    return result;
}

/**
 * Returns the magnitude (i.e. length) of this vector
 * @returns {Number}
 */
Vector4.prototype.magnitude = function () {
    let a = this.elements[0];
    let b = this.elements[1];
    let c = this.elements[2];
    let d = this.elements[3];
    return Math.sqrt(a * a + b * b + c * c + d * d);
}

/**
  * Normalize this Vector in-place and return the result
  * @returns {Vector4} this
  */
Vector4.prototype.normalize = function () {
    let v = this.elements;
    let len = this.magnitude();
    // zero case
    if (floatNearlyEqual(len, 0.0)) {
        v[0] = 0; v[1] = 0; v[2] = 0; v[3] = 0;
        return this;
    }
    // general case
    v[0] = v[0] / len;
    v[1] = v[1] / len;
    v[2] = v[2] / len;
    v[3] = v[3] / len;
    return this;
}

/**
 * Returns a copy of this vector with each element multiplied by "amount"
 * @param {Number} amount 
 * @returns {Vector3}
 */
Vector4.prototype.scaled = function (amount) {
    if (typeof amount !== "number") {
        throw `Invalid argument to scaled: ${amount}`;
    }
    let result = new Vector4(this.elements);
    for (let i = 0; i < 4; i++) {
        result.elements[i] *= amount;
    }
    return result;
}

/**
 * Returns a copy of this vector added component-wise to "other"
 * @param {Vector4} other 
 * @returns {Vector4}
 */
Vector4.prototype.add = function (other) {
    if (!isProbablyVector4(other)) {
        throw `Invalid argument to add: ${other}`;
    }
    let result = new Vector4(this.elements);
    for (let i = 0; i < 4; i++) {
        result.elements[i] += other.elements[i];
    }
    return result;
}

/** J. Tumblin 2018.02.13
  * Calculates and returns the (scalar) dot-product of the two Vector4 objects
  * @param {Vector4} other: the Vector4 to take the dot product with
  * @returns {Number}
  */
Vector4.prototype.dot = function (other, suppress_warning = false) {
    if (!isProbablyVector4(other)) {
        throw `Invalid argument to dot: ${other}`;
    }
    if (typeof suppress_warning !== "boolean") {
        throw `Invalid argument to dot: ${suppress_warning}`;
    }
    let vA = this.elements; // short-hand for the calling object
    let vB = other.elements;
    if (vA[3] * vB[3] !== 0) {
        console.log("WARNING! Vector4.dot() given non-zero \"w\" values: NOT a geometric result!!");
    }
    return vA[0] * vB[0] + vA[1] * vB[1] + vA[2] * vB[2] + vA[3] * vB[3];  // compute dot-product
}

/** J. Tumblin 2018.02.01
  * Print formatted contents of Vector4 to the console.
  * @param {String} opt_src an optional string argument to be formatted directly
  */
Vector4.prototype.printMe = function (opt_src = undefined) {
    let res = 5;
    if (opt_src && typeof opt_src === "string") {
        console.log(opt_src, ":",     // print the string argument given.
            this.elements[0].toFixed(res), "\t",
            this.elements[1].toFixed(res), "\t",
            this.elements[2].toFixed(res), "\t",
            this.elements[3].toFixed(res), "\n");
    }
    else {                    // user called printMe() with NO args, so...
        console.log("Vector4:",
            this.elements[0].toFixed(res), "\t",
            this.elements[1].toFixed(res), "\t",
            this.elements[2].toFixed(res), "\t",
            this.elements[3].toFixed(res), "\n");
    }
}

/**====================QUATERNIONS===============================================
 * @author mikael emtinger / http://gomo.se/
 * @author alteredq / http://alteredqualia.com/   <<== INSPIRING! visit site!
 * Written for the THREE.js library
 *
 * 2014.02.12 Modified by Jack Tumblin, Northwestern Univ.
 * 						for use in EECS 351-1 "Intro to Computer Graphics" class
 *						along with textbook "WebGL Programming Guide" (2013, Matsuda)
 *						but without the THREE.js graphics library.
 *	-- DROPPED original "setFromEuler()" function because it doesn"t follow the 
 * 			generally-accepted definition of Euler angles as described by Wikipedia.
 * 
 * 2025.08.06 Modified by Dietrich Geisler, Northwestern University
 * 
 *  -- Refactored logic to be consistently styled with rest of library
 *  -- implemented setFromEuler based on course definition
 *  -- fixed a bug with Quaternion setFromAxisAngle				
 */

/**
 * Constructor for a Quaternion
 * If opt_src is specified, new vector is initialized by opt_src 
 *   opt_src may be an Array, Quaternion, or Number
 * y, z, and w are only used if opt_src is a Number
 * Otherwise, intialize this as the identity Quaternion
 * @param {Float32Array|Quaternion} opt_src
 */
let Quaternion = function (opt_src = undefined, y = 0, z = 0, w = 0) {
    if (typeof opt_src !== "undefined") {
        if (isProbablyQuaternion(opt_src)) {
            this.set(opt_src.x, opt_src.y, opt_src.z, opt_src.w);
        }
        else if (typeof opt_src === "number") {
            let x = opt_src;
            this.set(x, y, z, w);
        }
        // otherwise, assume it's an array-like object
        else {
            this.set(...opt_src);
        }
    }
    else {
        this.set(0, 0, 0, 1);
    }
}

/**
 * Returns true if each element of this is roughly equal to other
 * Returns false otherwise
 * IMPORTANT: this does not check equivalence of rotations, only of values
 * NOTE: we allow relatively high tolerance by default due to the 
 *   amount of quaternion calculation nonsense
 * @param {Quaternion} other
 * @param {Number} tolerance how wide of a range to consider equal (optional)
 * @returns {Boolean}
 */
Quaternion.prototype.nearlyEquals = function (other, tolerance = 1e-4) {
    if (typeof tolerance !== "number") {
        throw `Invalid argument to nearlyEquals: ${tolerance}`;
    }
    if (!isProbablyQuaternion(other)) {
        return false;
    }
    let result = true;
    result = result && floatNearlyEqual(this.x, other.x, tolerance);
    result = result && floatNearlyEqual(this.y, other.y, tolerance);
    result = result && floatNearlyEqual(this.z, other.z, tolerance);
    result = result && floatNearlyEqual(this.w, other.w, tolerance);
    return result;
}

/**
 * Returns the string representation of this Quaternion
 * @param {Number} size the number of decimals to display
 * @returns {String}
 */
Quaternion.prototype.toString = function (size = 5) {
    if (typeof size !== "number") {
        throw `Invalid argument to toString: ${size}`;
    }
    let result = "Quaternion(";
    result += `x=${this.x.toFixed(size)}, `;
    result += `y=${this.y.toFixed(size)}, `;
    result += `z=${this.z.toFixed(size)}, `;
    result += `w=${this.w.toFixed(size)})`;
    return result;
}

/**
 * Sets this Quaternion explicitly to the given x, y, z, w
 * @param {Number} x 
 * @param {Number} y 
 * @param {Number} z 
 * @param {Number} w
 * @returns {Quaternion} this 
 */
Quaternion.prototype.set = function (x, y, z, w) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to set: ${value}`;
        }
    }
    checkNum(x);
    checkNum(y);
    checkNum(z);
    checkNum(w);

    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
}

/**
 * Copies the elements of other into this Quaternion
 * @param {Quaternion} other
 * @returns {Quaternion} this 
 */
Quaternion.prototype.setCopy = function (other) {
    if (!isProbablyQuaternion(other)) {
        throw `Invalid argument to setCopy: ${other}`;
    }

    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    this.w = other.w;
    return this;
}

/**
 * Resets this Quaternion to the identity rotation
 */
Quaternion.prototype.clear = function () {
    this.x = 0.0;
    this.y = 0.0;
    this.z = 0.0;
    this.w = 1.0;
}


/**
 * Sets w to normalize this Quaternion from x, y, and z
 * W retains its sign (rounded towards positive if nearly zero)
 * @returns {Quaternion} this
 */
Quaternion.prototype.calculateW = function () {
    //--------------------------------------
    let sign = -1;
    if (this.w > -1e-16) {
        sign = 1;
    }
    this.w = sign * Math.sqrt(Math.abs(
        1.0 - this.x * this.x - this.y * this.y - this.z * this.z));
    return this;
}

/**
 * Inverts this quaternion
 * @returns {Quaternion} this
 */
Quaternion.prototype.inverse = function () {
    //--------------------------------------
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this;
}

/**
 * Returns the length of this quaternion (if interpreted as a complex number)
 * @returns {Number}
 */
Quaternion.prototype.length = function () {
    //--------------------------------------\
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
}

/**
 * Normalizes this quaternion to have a length of 1
 * @returns {Quaternion} this
 */
Quaternion.prototype.normalize = function () {
    //--------------------------------------
    let len = this.length();
    if (floatNearlyEqual(len, 0.0)) {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.w = 0;
    }
    else {
        len = 1 / len;
        this.x = this.x * len;
        this.y = this.y * len;
        this.z = this.z * len;
        this.w = this.w * len;
    }
    return this;
}

/**
 * Returns the result of multiplying this by other
 * Neither this nor other are modified in this operation
 * @param {Quaternion} other 
 * @returns {Quaternion}
 */
Quaternion.prototype.multiply = function (other) {
    //--------------------------------------
    // from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm
    if (!isProbablyQuaternion(other)) {
        throw `Invalid argument to multiply: ${other}`;
    }
    var q1 = this;
    var q2 = other;
    let x = q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x;
    let y = -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y;
    let z = q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z;
    let w = -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w;
    return new Quaternion([x, y, z, w]);
}

/**
 * Sets this quaternion from the given Vector3 axis and angle (in degrees)
 * @param {Vector3} axis: will be normalized before use
 * @param {Number} angleDeg: angle around the axis in degrees 
 * @returns {Quaternion} this
 */
Quaternion.prototype.setFromAxisAngle = function (axis, angleDeg) {
    //--------------------------------------
    // Good tutorial on rotations; code inspiration at:
    //http://www.euclideanspace.com/maths/geometry/rotation
    //                          /conversions/angleToQuaternion/index.htm
    // Be sure we have a normalized x,y,z "axis" argument before we start:
    if (!isProbablyVector3(axis)) {
        throw `Invalid argument to setFromAxisAngle: ${axis}`;
    }
    if (typeof angleDeg !== "number") {
        throw `Invalid argument to setFromAxisAngle: ${angleDeg}`;
    }
    let normalized = new Vector3(axis.elements); // make a copy first
    normalized.normalize();
    let ax = normalized.elements[0];
    let ay = normalized.elements[1];
    let az = normalized.elements[2];

    let halfAngle = angleDeg * Math.PI / 360.0;	// (angleDeg/2) * (2*pi/360)
    let s = Math.sin(halfAngle);
    this.x = ax * s;
    this.y = ay * s;
    this.z = az * s;
    this.w = Math.cos(halfAngle);
    return this;
}

/**
 * Sets this Quaternion from the given alpha, beta, gamma Euler angles
 * Rotations are applied in order Yaw, Pitch, Roll
 * (This is equivalent to rotating around the z-axis, x-axis, z-axis in order)
 * @param {Number} yawDeg: the Yaw rotation angle, in degrees
 * @param {Number} pitchDeg: the Pitch rotation angle, in degrees 
 * @param {Number} rollDeg: the Roll rotation angle, in degrees 
 * @returns {Quaternion} this
 */
Quaternion.prototype.setFromEuler = function (yawDeg, pitchDeg, rollDeg) {
    function checkNum(value) {
        if (typeof value !== "number") {
            throw `Invalid argument to setFromEuler: ${value}`;
        }
    }
    checkNum(yawDeg);
    checkNum(pitchDeg);
    checkNum(rollDeg);

    // Get the radians of each rotation (divided by 2)
    // https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles#Euler_angles_(in_3-2-1_sequence)_to_quaternion_conversion
    let yawRad = yawDeg * Math.PI / 360.0;
    let pitchRad = pitchDeg * Math.PI / 360.0;
    let rollRad = rollDeg * Math.PI / 360.0;
    let cy = Math.cos(yawRad); let sy = Math.sin(yawRad);
    let cp = Math.cos(pitchRad); let sp = Math.sin(pitchRad);
    let cr = Math.cos(rollRad); let sr = Math.sin(rollRad);
    this.x = sr * cp * cy - cr * sp * sy;
    this.y = cr * sp * cy - sr * cp * sy;
    this.z = cr * cp * sy - sr * sp * cy;
    this.w = cr * cp * cy - sr * sp * sy;

    return this;
}

/**
 * Sets this Quaternion from the given rotation matrix m
 * if m is not a standard rotation matrix, 
 *   the behavior of this method is undefined
 * specifically, any scaling introduced may not be applied
 * @param {Matrix4} m 
 * @returns {Quaternion}
 */
Quaternion.prototype.setFromRotationMatrix = function (m) {
    //--------------------------------------
    // Adapted from: https://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/
    if (!isProbablyMatrix4(m)) {
        throw `Invalid argument to setFromRotationMatrix: ${m}`;
    }
    function copySign(a, b) {
        return b < 0 ? -Math.abs(a) : Math.abs(a);
    }
    let e = m.elements;
    this.w = Math.sqrt(Math.max(0, 1 + e[0] + e[5] + e[10])) / 2;
    this.x = Math.sqrt(Math.max(0, 1 + e[0] - e[5] - e[10])) / 2;
    this.y = Math.sqrt(Math.max(0, 1 - e[0] + e[5] - e[10])) / 2;
    this.z = Math.sqrt(Math.max(0, 1 - e[0] - e[5] + e[10])) / 2;
    this.x = copySign(this.x, (e[6] - e[9]));
    this.y = copySign(this.y, (e[8] - e[2]));
    this.z = copySign(this.z, (e[1] - e[4]));
    this.normalize();
    return this;
}

/**
 * Returns the result of applying this quaternion as a rotation to vec
 * @param {Vector3} vec 
 * @returns {Vector3}
 */
Quaternion.prototype.multiplyVector3 = function (vec) {
    //--------------------------------------
    if (!isProbablyVector3(vec)) {
        throw `Invalid argument to multiplyVector3: ${vec}`;
    }
    let x = vec.elements[0], y = vec.elements[1], z = vec.elements[2],
    qx = this.x, qy = this.y, qz = this.z, qw = this.w;

    // calculate quat * vec:
    let ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;
    // calculate result * inverse quat:
    let ox = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    let oy = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    let oz = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return new Vector3(ox, oy, oz);
}


/**
 * Prints this Quaternion formatted to the console
 */
Quaternion.prototype.printMe = function () {
    //---------------------------------------
    // 2014.02:  J. Tumblin
    res = 5;		// # of digits to print on HTML "console"
    console.log("Quaternion: x=", this.x.toFixed(res),
        "i\ty=", this.y.toFixed(res),
        "j\tz=", this.z.toFixed(res),
        "k\t(real)w=", this.w.toFixed(res), "\n");
}

/**
 * Applies a spherical interpolation between qa and qb with amount t
 * Neither qa nor qb are modified in this function
 * t should be between 0 and 1
 * NOTE: If qa or qb are not normalized, this function can have surprising behavior
 * @param {Quaternion} qa 
 * @param {Quaternion} qb
 * @param {Number} t 
 * @returns {Quaternion}
 */
Quaternion.slerp = function (qa, qb, t) {
    //--------------------------------------
    // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/
    if (!isProbablyQuaternion(qa)) {
        throw `Invalid argument to Quaternion.slerp: ${qa}`;
    }
    if (!isProbablyQuaternion(qb)) {
        throw `Invalid argument to Quaternion.slerp: ${qb}`;
    }
    if (typeof t !== "number") {
        throw `Invalid argument to Quaternion.slerp: ${t}`;
    }
    if (t > 1.01 || t < -.01) {
        throw(`t must be between 0 and 1, got ${t}`)
    }

    let qm = new Quaternion();
    let cosHalfTheta = qa.w * qb.w + qa.x * qb.x + qa.y * qb.y + qa.z * qb.z;

    if (cosHalfTheta < 0) {
        qm.w = -qb.w;
        qm.x = -qb.x;
        qm.y = -qb.y;
        qm.z = -qb.z;
        cosHalfTheta = -cosHalfTheta;
    }
    else { qm = new Quaternion(qb); }

    if (Math.abs(cosHalfTheta) >= 1.0) {
        qm.w = qa.w;
        qm.x = qa.x;
        qm.y = qa.y;
        qm.z = qa.z;
        return qm;
    }

    let halfTheta = Math.acos(cosHalfTheta),
        sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

    if (Math.abs(sinHalfTheta) < 0.0001) {
        qm.w = 0.5 * (qa.w + qb.w);
        qm.x = 0.5 * (qa.x + qb.x);
        qm.y = 0.5 * (qa.y + qb.y);
        qm.z = 0.5 * (qa.z + qb.z);
        return qm;
    }

    let ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta,
        ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    qm.w = (qa.w * ratioA + qm.w * ratioB);
    qm.x = (qa.x * ratioA + qm.x * ratioB);
    qm.y = (qa.y * ratioA + qm.y * ratioB);
    qm.z = (qa.z * ratioA + qm.z * ratioB);
    return qm;
}