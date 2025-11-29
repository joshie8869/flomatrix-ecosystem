// app/engine/core/engine-core.js
// FloEngine v1.5 → v3.0 — core init + resize + render loop + footprint wiring

import { createGLContext } from "./gl-context.js";
import { createShaderProgram } from "./shaders.js";
import { initBuffers } from "./buffers.js";
import { renderFrame, createEngineState } from "./renderer.js";
import {
  FOOTPRINT_MODE_BID_ASK,
  rebuildFootprintBuffer
} from "../modules/footprint.js";

/* FM-PAD:BEGIN-ENGINE-CORE-INIT */
export function initFloEngine(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error("FloEngine: canvas not found:", canvasId);
    return;
  }

  const gl = createGLContext(canvas);
  if (!gl) {
    console.error("FloEngine: WebGL not supported.");
    return;
  }

  const program = createShaderProgram(gl);
  if (!program) {
    console.error("FloEngine: failed to create shader program.");
    return;
  }

  gl.useProgram(program);

  // Enable alpha blending for faint grid / overlays
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const uResolution = gl.getUniformLocation(program, "u_resolution");

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    gl.viewport(0, 0, canvas.width, canvas.height);

    if (uResolution) {
      gl.uniform2f(uResolution, canvas.width, canvas.height);
    }

    // When we resize, we rebuild core buffers from scratch.
    const newBuffers = initBuffers(gl, program, () => ({
      width: canvas.width,
      height: canvas.height
    }));

    // Preserve footprint mode if we already had a state.
    const prevMode =
      window.__floEngineState &&
      window.__floEngineState.buffers &&
      typeof window.__floEngineState.buffers.footprintMode === "number"
        ? window.__floEngineState.buffers.footprintMode
        : FOOTPRINT_MODE_BID_ASK;

    // Rebuild footprint buffer for the chosen mode.
    rebuildFootprintBuffer(gl, newBuffers, prevMode);

    if (window.__floEngineState) {
      window.__floEngineState.buffers = newBuffers;
    } else {
      // initial path
      const initialState = createEngineState(gl, canvas, program, newBuffers);
      window.__floEngineState = initialState;
    }
  }

  // Initial buffers + footprint
  const initialBuffers = initBuffers(gl, program, () => ({
    width: canvas.width || canvas.clientWidth || 1280,
    height: canvas.height || canvas.clientHeight || 720
  }));

  rebuildFootprintBuffer(gl, initialBuffers, FOOTPRINT_MODE_BID_ASK);

  const state = createEngineState(gl, canvas, program, initialBuffers);

  // Public footprint mode API (for future UI / dev console)
  state.footprintMode = FOOTPRINT_MODE_BID_ASK;
  state.setFootprintMode = (mode) => {
    if (typeof mode !== "number") return;
    rebuildFootprintBuffer(gl, state.buffers, mode);
    state.footprintMode = mode;
  };

  window.__floEngineState = state;

  // Also expose a simple global helper to switch footprint mode:
  //   0 = BID/ASK, 1 = DELTA, 2 = PROFILE
  window.__floSetFootprintMode = (mode) => {
    if (!window.__floEngineState || !window.__floEngineState.setFootprintMode) return;
    window.__floEngineState.setFootprintMode(mode);
  };

  // Run the resize once to sync viewport & rebuild buffers
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function loop(timestamp) {
    renderFrame(gl, state, timestamp);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
/* FM-PAD:END-ENGINE-CORE-INIT */
