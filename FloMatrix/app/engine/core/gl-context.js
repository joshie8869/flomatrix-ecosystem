// app/engine/core/gl-context.js
// FloEngine v3.0 — WebGL context bootstrap
// Creates a robust WebGL context with sane defaults for
// institutional chart rendering.
//
// FM-GL-CONTEXT-001

/**
 * Create a WebGL rendering context with fallback logic.
 * @param {HTMLCanvasElement} canvas
 * @returns {WebGLRenderingContext | WebGL2RenderingContext | null}
 */
export function createGLContext(canvas) {
  if (!canvas) {
    console.error("[FloEngine] createGLContext called with null canvas");
    return null;
  }

  const contextAttributes = {
    alpha: false,          // opaque background (we manage clears)
    antialias: true,       // smoother edges
    depth: false,          // 2D chart, no depth buffer needed
    stencil: false,
    preserveDrawingBuffer: false,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  };

  let gl = null;

  // Prefer WebGL2 if available
  try {
    gl = canvas.getContext("webgl2", contextAttributes);
  } catch (err) {
    console.warn("[FloEngine] Error requesting WebGL2 context:", err);
    gl = null;
  }

  if (!gl) {
    try {
      gl =
        canvas.getContext("webgl", contextAttributes) ||
        canvas.getContext("experimental-webgl", contextAttributes);
    } catch (err) {
      console.warn("[FloEngine] Error requesting WebGL context:", err);
      gl = null;
    }
  }

  if (!gl) {
    console.error(
      "[FloEngine] Unable to initialize WebGL. Your browser or GPU may not support it."
    );
    return null;
  }

  // -----------------------------
  // Core GL configuration
  // -----------------------------

  // We render 2D charts; no depth test needed.
  gl.disable(gl.DEPTH_TEST);

  // Enable alpha blending for neon candles, overlays, etc.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // No face culling — we’re drawing simple quads in screen space.
  gl.disable(gl.CULL_FACE);

  // Clear once to a solid black background.
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const isWebGL2 =
    typeof WebGL2RenderingContext !== "undefined" &&
    gl instanceof WebGL2RenderingContext;

  console.info(
    "[FloEngine] WebGL context initialized:",
    isWebGL2 ? "WebGL2" : "WebGL1"
  );

  return gl;
}
