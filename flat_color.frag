precision mediump float;

uniform sampler2D u_Texture;

uniform vec3  u_Tint;        
uniform float u_UseTexture;  
uniform float u_Alpha;
uniform float u_Time;
uniform vec3  u_LightPos;

uniform vec3  u_ViewPos;     
uniform float u_IsLight;

uniform float u_LightingMode;

varying vec2 v_TexCoord;
varying vec3 v_NormalHint;
varying vec3 v_WorldPos;

vec3 toLinear(vec3 srgb)  { return pow(srgb, vec3(2.2)); }
vec3 toSRGB(vec3 linear)  { return pow(linear, vec3(1.0/2.2)); }

void main() {

    // Base color
    vec3 baseColor = (u_UseTexture > 0.5)
        ? texture2D(u_Texture, v_TexCoord).rgb
        : u_Tint;

    if (u_UseTexture > 0.5) {
        baseColor = clamp(baseColor * 1.05 + 0.02, 0.0, 1.0);
    }

    // Sun/Moon = no shading
    if (u_IsLight > 0.5) {
        gl_FragColor = vec4(baseColor, u_Alpha);
        return;
    }

    // Lighting
    vec3 albedo = toLinear(baseColor);
    vec3 N = normalize(v_NormalHint);
    vec3 L = u_LightPos - v_WorldPos;
    float lenL = length(L);
    L = (lenL > 1e-4) ? (L / lenL) : normalize(vec3(0.3, 0.7, 0.2));

    vec3 V = normalize(u_ViewPos - v_WorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);

    float spec = 0.0;
    if (diff > 0.0) {
        float shininess = 64.0;
        spec = pow(max(dot(N, H), 0.0), shininess);
    }

    // Toon shading
    if (u_LightingMode > 0.5) {
        float d = diff;
        if      (d > 0.75) d = 1.0;
        else if (d > 0.40) d = 0.6;
        else if (d > 0.10) d = 0.25;
        else               d = 0.05;
        diff = d;

        spec = (spec > 0.3) ? 0.8 : 0.0;

        baseColor *= vec3(1.2, 0.9, 1.2);
    }

    float ambient = 0.25;
    vec3 lightColor = vec3(1.0);
    if (u_UseTexture < 0.5 && u_IsLight < 0.5 && baseColor.r > 0.9 && baseColor.g > 0.9 && baseColor.b > 0.9) {
    float twinkle = 0.3 + 0.7 * sin(u_Time * 10.0 + v_WorldPos.x * 6.0);
    baseColor *= twinkle;
}
    vec3 color =
        baseColor * (ambient + diff) * lightColor +
        spec * lightColor;

    gl_FragColor = vec4(color, u_Alpha);
}
