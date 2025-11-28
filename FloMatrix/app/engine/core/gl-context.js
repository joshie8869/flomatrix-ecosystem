// app/engine/core/gl-context.js
// Creates a WebGL context with some basic extension checks.

export function createGLContext(canvas) {
  const gl =
    canvas.getContext("webgl2", { antialias: true }) ||
    canvas.getContext("webgl", { antialias: true }) ||
    canvas.getContext("experimental-webgl");

  if (!gl) {
    alert("Your browser or GPU does not support WebGL. FloMatrix cannot run.");
    return null;
  }

  // Basic clear color (background will mostly be from CSS, but we leave a guard)
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Enable blending for neon edges later
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return gl;
}
