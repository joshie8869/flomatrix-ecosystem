// app/engine/core/engine-core.js
// FloEngine v1.5 — core init + resize + render loop

import { createGLContext } from "./gl-context.js";
import { createShaderProgram } from "./shaders.js";
import { initBuffers } from "./buffers.js";
import { renderFrame, createEngineState } from "./renderer.js";

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
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const buffers = initBuffers(gl, program, () => ({
    width: canvas.width,
    height: canvas.height
  }));

  const state = createEngineState(gl, canvas, program, buffers);
  window.__floEngineState = state;

  function loop(timestamp) {
    renderFrame(gl, state, timestamp);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
