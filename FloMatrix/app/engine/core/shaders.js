// ============================================================================
// app/engine/core/shaders.js
// FloEngine v3.0 — Full Shader Stack (Candles + Grid + Footprint)
// FIXED + CLEANED + UPGRADED
// ============================================================================
//
// This is the complete and corrected shader module for FloMatrix.
//
// Fixes included:
// ✔ Correct WebGL shader compilation check (no more getShaderParameter errors)
// ✔ Corrected program linking logic
// ✔ Verified vertex + fragment GLSL syntax
// ✔ Clean reset of neon systems (bid/ask/delta/profile)
// ✔ Fully validated attribute/varying flow
// ✔ No snippets — FULL file below.
//
// ============================================================================

// =======================
// VERTEX SHADER
// =======================
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute float a_bull;
  attribute float a_border;

  uniform vec2 u_resolution;

  varying float v_bull;
  varying float v_border;
  varying float v_y; // normalized 0..1 screen height

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);

    v_bull = a_bull;
    v_border = a_border;
    v_y = zeroToOne.y;
  }
`;

// =======================
// FRAGMENT SHADER
// =======================
const fragmentShaderSource = `
  precision mediump float;

  varying float v_bull;
  varying float v_border;
  varying float v_y;

  // ----------------------
  // COLOR HELPERS
  // ----------------------

  vec3 bullBase() {
    return vec3(0.18, 0.95, 0.49);
  }
  vec3 bullTop() {
    return vec3(0.08, 0.80, 0.38);
  }

  vec3 bearBase() {
    return vec3(1.00, 0.40, 0.60);
  }
  vec3 bearTop() {
    return vec3(0.90, 0.20, 0.45);
  }

  vec3 footprintBidBase() {
    return vec3(0.00, 0.90, 0.60);
  }
  vec3 footprintAskBase() {
    return vec3(1.00, 0.25, 0.65);
  }

  vec3 footprintDeltaPos() {
    return vec3(0.25, 1.00, 0.60);
  }
  vec3 footprintDeltaNeg() {
    return vec3(1.00, 0.10, 0.55);
  }

  vec3 footprintProfileBase() {
    return vec3(0.05, 0.95, 0.85);
  }

  // ----------------------
  // MAIN
  // ----------------------
  void main() {

    // -------------------------
    // FOOTPRINT SYSTEM (v_border >= 9.5)
    // -------------------------
    if (v_border > 9.5) {
      float intensity = clamp(abs(v_bull), 0.02, 1.0);
      vec3 baseColor;

      // BID CELL (10.x)
      if (v_border > 9.5 && v_border < 10.5) {
        baseColor = mix(vec3(0.02, 0.22, 0.12), footprintBidBase(), intensity);
      }
      // ASK CELL (11.x)
      else if (v_border >= 10.5 && v_border < 11.5) {
        baseColor = mix(vec3(0.16, 0.02, 0.12), footprintAskBase(), intensity);
      }
      // DELTA CELL (12.x) — sign + magnitude in v_bull
      else if (v_border >= 11.5 && v_border < 12.5) {
        float mag = clamp(abs(v_bull), 0.02, 1.0);
        if (v_bull >= 0.0) {
          baseColor = mix(vec3(0.05, 0.25, 0.10), footprintDeltaPos(), mag);
        } else {
          baseColor = mix(vec3(0.25, 0.02, 0.18), footprintDeltaNeg(), mag);
        }
      }
      // PROFILE CELL (13.x)
      else {
        baseColor = mix(vec3(0.02, 0.20, 0.16), footprintProfileBase(), intensity);
      }

      gl_FragColor = vec4(baseColor, 0.90);
      return;
    }

    // -------------------------
    // GRID SYSTEM (v_border ~ 3)
    // -------------------------
    if (v_border > 2.5 && v_border < 3.5) {
      vec3 gridColor = vec3(0.08, 0.80, 0.55);
      gl_FragColor = vec4(gridColor, 0.10);
      return;
    }

    // -------------------------
    // CANDLE SYSTEM
    // -------------------------

    // vertical gradient
    float t = clamp(v_y, 0.0, 1.0);

    vec3 bullColor = mix(bullTop(), bullBase(), t);
    vec3 bearColor = mix(bearTop(), bearBase(), t);
    vec3 baseColor = (v_bull >= 0.5) ? bullColor : bearColor;

    // WICK (2.x)
    if (v_border > 1.5) {
      baseColor = mix(baseColor, vec3(1.0, 1.0, 1.0), 0.18);
    }
    // BORDER (1.x)
    else if (v_border > 0.5) {
      if (v_bull >= 0.5) {
        baseColor = mix(bullTop(), vec3(0.02, 0.32, 0.18), 0.65);
      } else {
        baseColor = mix(bearTop(), vec3(0.20, 0.02, 0.11), 0.65);
      }
    }

    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

// ============================================================================
// CORE WEBGL HELPER — FIXED & CLEAN
// ============================================================================

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error("FloEngine ERROR: Unable to create shader.");
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // *** FIXED: Must check SHADER, not gl ***
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (!ok) {
    console.error("FloEngine Shader Compile Error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

// ============================================================================
// PROGRAM LINKER — FIXED & CLEAN
// ============================================================================

export function createShaderProgram(gl) {
  const vertexShader   = compileShader(gl, gl.VERTEX_SHADER,   vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  if (!vertexShader || !fragmentShader) {
    console.error("FloEngine ERROR: One or more shaders failed to compile.");
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    console.error("FloEngine ERROR: Cannot create shader program.");
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const ok = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (!ok) {
    console.error("FloEngine Program Link Error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  // Clean up after link
  gl.detachShader(program, vertexShader);
  gl.detachShader(program, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

// ============================================================================
// END OF FILE — FULL, COMPLETE, FIXED
// ============================================================================
