// app/engine/core/shaders.js
// FloEngine v3.0 — shader sources + program builder
// Minimal 2D pipeline for neon institutional candles.
//
// FM-SHADERS-CORE-001

/**
 * Compile a shader of given type from source.
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
 * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param {string} source
 * @returns {WebGLShader|null}
 */
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error("[FloEngine] Unable to create shader object");
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    const info = gl.getShaderInfoLog(shader);
    console.error("[FloEngine] Shader compile error:", info);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Link vertex + fragment shaders into a program.
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
 * @param {WebGLShader} vertexShader
 * @param {WebGLShader} fragmentShader
 * @returns {WebGLProgram|null}
 */
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  if (!program) {
    console.error("[FloEngine] Unable to create program object");
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    const info = gl.getProgramInfoLog(program);
    console.error("[FloEngine] Program link error:", info);
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

/**
 * Build a minimal shader program suitable for 2D neon candles.
 * Attributes:
 *   a_position: vec2 (pixel-space x,y)
 *   a_color:    vec4 (r,g,b,a)
 * Uniforms:
 *   u_resolution: vec2 (viewport width,height in pixels)
 *
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
 * @returns {WebGLProgram|null}
 */
export function createProgramFromSources(gl) {
  const vertexSource = `
    precision mediump float;

    attribute vec2 a_position;
    attribute vec4 a_color;

    uniform vec2 u_resolution;

    varying vec4 v_color;

    void main() {
      // convert from pixel space (0..width, 0..height)
      // to 0..1
      vec2 zeroToOne = a_position / u_resolution;

      // convert 0..1 to 0..2
      vec2 zeroToTwo = zeroToOne * 2.0;

      // convert 0..2 to -1..1
      vec2 clipSpace = zeroToTwo - 1.0;

      // flip Y because WebGL has +Y up, but pixels have +Y down
      clipSpace.y = -clipSpace.y;

      gl_Position = vec4(clipSpace, 0.0, 1.0);
      v_color = a_color;
    }
  `;

  const fragmentSource = `
    precision mediump float;

    varying vec4 v_color;

    void main() {
      gl_FragColor = v_color;
    }
  `;

  const vShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vShader || !fShader) {
    console.error("[FloEngine] Failed to compile shaders");
    return null;
  }

  const program = createProgram(gl, vShader, fShader);
  if (!program) {
    console.error("[FloEngine] Failed to link shader program");
    return null;
  }

  return program;
}
