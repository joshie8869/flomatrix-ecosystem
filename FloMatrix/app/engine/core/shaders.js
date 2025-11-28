// app/engine/core/shaders.js
// Holds shader sources and compiles/link them into a program.

const VERT_SRC = `
  attribute vec2 a_position;
  attribute float a_bull;   // 1.0 = bull, 0.0 = bear

  uniform vec2 u_resolution;

  varying float v_bull;

  void main() {
    // Convert from pixel-ish coordinates to clipspace
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;

    // Flip Y because WebGL is bottom-left
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    v_bull = a_bull;
  }
`;

const FRAG_SRC = `
  precision mediump float;

  varying float v_bull;

  // FloMatrix neon green
  const vec3 NEON_GREEN = vec3(0.18, 0.95, 0.49); // approx #2EF27E
  const vec3 BEAR_PINK  = vec3(1.0, 0.32, 0.42);

  void main() {
    // Choose base color depending on bull/bear
    vec3 base = mix(BEAR_PINK, NEON_GREEN, v_bull);

    // Simple vertical gradient based on fragment Y in NDC is possible,
    // but here we just give a subtle glow-ish effect.
    float glow = 0.25;

    vec3 color = base + glow * base;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createShaderProgram(gl) {
  const vertShader = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);

  if (!vertShader || !fragShader) {
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("FloEngine: Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  gl.deleteShader(vertShader);
  gl.deleteShader(fragShader);

  return program;
}

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("FloEngine: Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
