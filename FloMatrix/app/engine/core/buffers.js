// app/engine/core/buffers.js
// FloEngine v1.1 — center candles based on real screen size

export function initBuffers(gl, program, getRes) {
  const { width, height } = getRes();

  const centerX = width / 2;
  const centerY = height / 2;

  const candleWidth = 40;
  const candleHeight = 120;

  function makeCandle(xOffset, bull = 1) {
    const x1 = centerX + xOffset - candleWidth / 2;
    const x2 = centerX + xOffset + candleWidth / 2;
    const y1 = centerY - candleHeight / 2;
    const y2 = centerY + candleHeight / 2;

    return [
      x1, y1, bull,
      x2, y1, bull,
      x1, y2, bull,

      x1, y2, bull,
      x2, y1, bull,
      x2, y2, bull
    ];
  }

  const candleData = [
    ...makeCandle(-120, 1),
    ...makeCandle(0, 0),
    ...makeCandle(120, 1)
  ];

  const candleBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, candleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(candleData), gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, "a_position");
  const aBull = gl.getAttribLocation(program, "a_bull");
  const uResolution = gl.getUniformLocation(program, "u_resolution");

  const stride = 3 * 4;
  const offsetPos = 0;
  const offsetBull = 2 * 4;

  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, offsetPos);

  gl.enableVertexAttribArray(aBull);
  gl.vertexAttribPointer(aBull, 1, gl.FLOAT, false, stride, offsetBull);

  gl.uniform2f(uResolution, width, height);

  return {
    buffer: candleBuffer,
    vertexCount: candleData.length / 3,
    getRes
  };
}
