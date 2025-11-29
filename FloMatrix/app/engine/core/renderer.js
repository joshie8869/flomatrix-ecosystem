// app/engine/core/renderer.js
// FloEngine v1.5 → v3.0 — deep black background, grid + candles + footprint layer
//
// New in v3.0:
//  - Adds a 3rd draw pass for the footprint buffer (if present).
//  - Uses same attribute layout for candles, grid, and footprint:
//       vec2 a_position, float a_bull, float a_border
//  - Fragment shader distinguishes footprint via v_border >= 9.5.

export function createEngineState(gl, canvas, program, buffers) {
  return {
    gl,
    canvas,
    program,
    buffers,
    lastTime: 0,
    fpsSmoothed: 60
  };
}

/* FM-PAD:BEGIN-RENDERER-BIND-ATTRIBS */
function bindAttribs(gl, buffers, bufferType) {
  let buffer = null;

  if (bufferType === "grid") {
    buffer = buffers.gridBuffer;
  } else if (bufferType === "candle") {
    buffer = buffers.candleBuffer;
  } else if (bufferType === "footprint") {
    buffer = buffers.footprintBuffer;
  }

  if (!buffer) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  const stride = 4 * 4; // x, y, bull/value, borderCode
  const offsetPos = 0;
  const offsetBull = 2 * 4;
  const offsetBorder = 3 * 4;

  gl.enableVertexAttribArray(buffers.aPosition);
  gl.vertexAttribPointer(buffers.aPosition, 2, gl.FLOAT, false, stride, offsetPos);

  gl.enableVertexAttribArray(buffers.aBull);
  gl.vertexAttribPointer(buffers.aBull, 1, gl.FLOAT, false, stride, offsetBull);

  gl.enableVertexAttribArray(buffers.aBorder);
  gl.vertexAttribPointer(buffers.aBorder, 1, gl.FLOAT, false, stride, offsetBorder);
}
/* FM-PAD:END-RENDERER-BIND-ATTRIBS */

/* FM-PAD:BEGIN-RENDERER-RENDER-FRAME */
export function renderFrame(gl, state, timestamp) {
  const dt = timestamp - state.lastTime;
  state.lastTime = timestamp;

  const fpsInstant = dt > 0 ? 1000 / dt : 60;
  state.fpsSmoothed = state.fpsSmoothed * 0.9 + fpsInstant * 0.1;

  const buffers = state.buffers;

  // Deep black background
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // 1) Draw faint grid (lines)
  bindAttribs(gl, buffers, "grid");
  if (buffers.gridVertexCount && buffers.gridVertexCount > 0) {
    gl.drawArrays(gl.LINES, 0, buffers.gridVertexCount);
  }

  // 2) Draw candles on top (triangles)
  bindAttribs(gl, buffers, "candle");
  if (buffers.candleVertexCount && buffers.candleVertexCount > 0) {
    gl.drawArrays(gl.TRIANGLES, 0, buffers.candleVertexCount);
  }

  // 3) Draw footprint layer ABOVE candles (if present)
  if (buffers.footprintBuffer && buffers.footprintVertexCount > 0) {
    bindAttribs(gl, buffers, "footprint");
    gl.drawArrays(gl.TRIANGLES, 0, buffers.footprintVertexCount);
  }
}
/* FM-PAD:END-RENDERER-RENDER-FRAME */
