precision mediump float;

attribute vec3 a_Position;
attribute vec2 a_UV;

uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_Projection;

varying vec2 v_TexCoord;
varying vec3 v_WorldPos;
varying vec3 v_NormalHint;

void main() {
    // World-space position
    vec4 worldPos = u_World * u_Model * vec4(a_Position, 1.0);
    v_WorldPos = worldPos.xyz;

    // Pass through UVs
    v_TexCoord = a_UV;

    // Approx normal using model-space position
    v_NormalHint = a_Position;

    gl_Position = u_Projection * u_Camera * worldPos;
}