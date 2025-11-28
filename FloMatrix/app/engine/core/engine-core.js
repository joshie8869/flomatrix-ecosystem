// app/engine/core/engine-core.js
// FloEngine v1.1 — Real resolution + visible candles + debug grid

import { createGLContext } from "./gl-context.js";
import { createShaderProgram } from "./shaders.js";
import { initBuffers } from "./buffers.js";
import { renderFrame, createEngineState } from "./renderer.js";

export function initFloEngine(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error("Canvas not found: ", canvasId);
    return;
  }

  const gl = createGLContext(canvas);
  if (!gl) {
    console.error("WebGL context failed.");
    return;
  }

  const program = createShaderProgram(gl);
  if (!program) {
    console.error("Shader program creation failed.");
    return;
  }

  gl.useProgram(program);

  // Real dynamic resolution
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    gl.viewport(0, 0, canvas.width, canvas.height);

    if (window.__floEngineState) {
      const resLoc = gl.getUniformLocation(program, "u_resolution");
      gl.uniform2f(resLoc, canvas.width, canvas.height);
    }
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Buffers now scale to actual viewport
  const buffers = initBuffers(gl, program, () => {
    return { width: canvas.width, height: canvas.height };
  });

  const state = createEngineState(gl, canvas, program, buffers);
  window.__floEngineState = state;

  // Render loop
  function loop(ts) {
    renderFrame(gl, state, ts);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
