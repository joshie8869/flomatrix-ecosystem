// app/engine/core/renderer.js
// FloEngine v1.1 — draw debug grid + candles

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

export function renderFrame(gl, state, ts) {
  const dt = ts - state.lastTime;
  state.lastTime = ts;

  const fpsInstant = dt > 0 ? 1000 / dt : 60;
  state.fpsSmoothed = state.fpsSmoothed * 0.9 + fpsInstant * 0.1;

  // Neon background
  gl.clearColor(0.01, 0.01, 0.01, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Draw debug grid (optional)
  drawDebugGrid(gl, state.canvas);

  // Draw candles
  gl.drawArrays(gl.TRIANGLES, 0, state.buffers.vertexCount);
}

function drawDebugGrid(gl, canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(46,242,126,0.08)";
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}
