// app/engine/core/renderer.js
// FloEngine v1.3 — render OHLC candles from buffers.

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

export function renderFrame(gl, state, timestamp) {
  const dt = timestamp - state.lastTime;
  state.lastTime = timestamp;

  const fpsInstant = dt > 0 ? 1000 / dt : 60;
  state.fpsSmoothed = state.fpsSmoothed * 0.9 + fpsInstant * 0.1;

  // Future: we’ll drive adaptive glow intensity based on fpsSmoothed
  // For now, just a super dark blue/black background.
  gl.clearColor(0.01, 0.01, 0.05, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Draw all triangles in the buffer (wicks + bodies)
  gl.drawArrays(gl.TRIANGLES, 0, state.buffers.vertexCount);
}
