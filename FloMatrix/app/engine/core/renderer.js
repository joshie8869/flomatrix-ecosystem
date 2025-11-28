// app/engine/core/renderer.js
// FloEngine v1.5 — deep black background, grid + candles

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

function bindAttribs(gl, buffers, useGrid) {
  const buffer = useGrid ? buffers.gridBuffer : buffers.candleBuffer;

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  const stride = 4 * 4; // x, y, bull, border
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
  bindAttribs(gl, buffers, true);
  gl.drawArrays(gl.LINES, 0, buffers.gridVertexCount);

  // 2) Draw candles on top (triangles)
  bindAttribs(gl, buffers, false);
  gl.drawArrays(gl.TRIANGLES, 0, buffers.candleVertexCount);
}
