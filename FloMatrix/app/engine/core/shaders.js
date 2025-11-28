// app/engine/core/shaders.js
// FloEngine v1.5 — pro candle lighting, borders, grid, refined wicks

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute float a_bull;
  attribute float a_border;

  uniform vec2 u_resolution;

  varying float v_bull;
  varying float v_border;
  varying float v_y; // normalized screen y

  void main() {
    // from pixels to 0..1
    vec2 zeroToOne = a_position / u_resolution;
    // to clip space (-1..1, invert y for WebGL coords)
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);

    v_bull = a_bull;
    v_border = a_border;
    v_y = zeroToOne.y; // screen-space vertical position
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying float v_bull;
  varying float v_border;
  varying float v_y;

  // FloMatrix signature colors (approx #2EF27E for bull)
  vec3 bullBase() {
    return vec3(0.18, 0.95, 0.49);
  }
  vec3 bullTop() {
    return vec3(0.08, 0.80, 0.38);
  }

  // Bear / sell color (deep fluorescent magenta / crimson)
  vec3 bearBase() {
    return vec3(1.00, 0.40, 0.60);
  }
  vec3 bearTop() {
    return vec3(0.90, 0.20, 0.45);
  }

  void main() {
    // Grid lines (v_border ~ 3.0)
    if (v_border > 2.5) {
      // very faint teal-ish grid
      vec3 gridColor = vec3(0.08, 0.80, 0.55);
      gl_FragColor = vec4(gridColor, 0.10); // low alpha, just a whisper
      return;
    }

    // Base candle color with slight vertical gradient (0 top, 1 bottom)
    float t = clamp(v_y, 0.0, 1.0);

    vec3 bullColor = mix(bullTop(), bullBase(), t);
    vec3 bearColor = mix(bearTop(), bearBase(), t);
    vec3 baseColor = (v_bull >= 0.5) ? bullColor : bearColor;

    // Differentiate by border flag:
    //  0.0 = inner fill
    //  1.0 = body border shell
    //  2.0 = wick (slightly brighter / refined)
    if (v_border > 1.5) {
      // wick: sharpen & brighten slightly
      baseColor = mix(baseColor, vec3(1.0, 1.0, 1.0), 0.18);
    } else if (v_border > 0.5) {
      // body border: darker, more defined frame
      if (v_bull >= 0.5) {
        baseColor = mix(bullTop(), vec3(0.02, 0.32, 0.18), 0.65);
      } else {
        baseColor = mix(bearTop(), vec3(0.20, 0.02, 0.11), 0.65);
      }
    }

    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    console.error("FloEngine shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function createShaderProgram(gl) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    console.error("FloEngine shader program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}
